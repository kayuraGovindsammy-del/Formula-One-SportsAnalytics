import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Response } from "express";
import request from "supertest";
import { ApiError } from "./ApiError.js";
import type { AuthenticatedRequest } from "./authenticate.js";

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  deletionRequested: vi.fn(),
  markerGet: vi.fn(),
  userGet: vi.fn(),
}));

vi.mock("../services/accountDeletion.js", () => ({
  deletionRequested: mocks.deletionRequested,
}));

vi.mock("../config/firebaseAdmin.js", () => ({
  getAdminAuth: () => ({
    verifyIdToken: mocks.verifyIdToken,
  }),
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: () => ({
        get: name === "accountDeletions" ? mocks.markerGet : mocks.userGet,
      }),
    }),
  }),
}));

import { authenticate } from "./authenticate.js";
import { createApp } from "../app.js";

function makeResponse() {
  let statusCode = 200;
  const json = vi.fn();
  const res = {
    status: vi.fn((value: number) => {
      statusCode = value;
      return res;
    }),
    json,
  } as unknown as Response;

  return {
    res,
    json,
    status: () => statusCode,
  };
}

function makeRequest(authorization?: string): AuthenticatedRequest {
  return {
    headers: authorization ? { authorization } : {},
  } as AuthenticatedRequest;
}

async function invoke(authorization?: string) {
  const req = makeRequest(authorization);
  const response = makeResponse();
  const next = vi.fn() as NextFunction;

  await authenticate(req, response.res, next);

  return {
    req,
    next,
    json: response.json,
    status: response.status(),
  };
}

type InvokeResult = Awaited<ReturnType<typeof invoke>>;

/**
 * A rejection is forwarded to errorHandler as an ApiError, never written to
 * the response directly — that is what keeps the envelope consistent.
 */
function expectRejected(
  result: InvokeResult,
  httpStatus: number,
  code: string,
  message: string
) {
  expect(result.json).not.toHaveBeenCalled();
  expect(result.req.authenticatedUser).toBeUndefined();
  expect(result.next).toHaveBeenCalledOnce();

  const forwarded: unknown = vi.mocked(result.next).mock.calls[0]?.[0];
  expect(forwarded).toBeInstanceOf(ApiError);
  expect(forwarded).toMatchObject({ httpStatus, code, message });
}

const validToken = {
  uid: "uid-123",
  email: "driver@example.test",
  auth_time: 1_700_000_000,
};

describe("authenticate middleware", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.verifyIdToken.mockResolvedValue(validToken);
    mocks.deletionRequested.mockResolvedValue(false);
    mocks.markerGet.mockResolvedValue({ exists: false });
    mocks.userGet.mockResolvedValue({
      exists: true,
      data: () => ({
        email: "profile@example.test",
        name: "Test Driver",
        role: "USER",
        submitterStatus: "NONE",
      }),
    });
  });

  it("rejects requests without a Bearer token", async () => {
    const result = await invoke();

    expectRejected(result, 401, "UNAUTHENTICATED", "Firebase ID token required.");
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("rejects malformed authorization headers", async () => {
    const result = await invoke("Basic abc123");

    expectRejected(result, 401, "UNAUTHENTICATED", "Firebase ID token required.");
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("rejects invalid or expired Firebase tokens", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(new Error("invalid token"));

    const result = await invoke("Bearer invalid-token");

    expect(mocks.verifyIdToken).toHaveBeenCalledWith("invalid-token", true);
    expectRejected(result, 401, "UNAUTHENTICATED", "Invalid or expired Firebase token.");
  });

  it("rejects users with a durable SQL deletion request", async () => {
    mocks.deletionRequested.mockResolvedValueOnce(true);

    const result = await invoke("Bearer valid-token");

    expectRejected(result, 403, "FORBIDDEN", "Account deletion has been requested.");
    expect(mocks.markerGet).not.toHaveBeenCalled();
  });

  it("rejects users with a Firestore account-deletion marker", async () => {
    mocks.markerGet.mockResolvedValueOnce({ exists: true });

    const result = await invoke("Bearer valid-token");

    expectRejected(result, 403, "FORBIDDEN", "Account deletion has been requested.");
    expect(mocks.userGet).not.toHaveBeenCalled();
  });

  it("rejects authenticated users without a Firestore profile", async () => {
    mocks.userGet.mockResolvedValueOnce({ exists: false });

    const result = await invoke("Bearer valid-token");

    expectRejected(result, 401, "UNAUTHENTICATED", "No Firestore user profile exists.");
  });

  it("rejects users whose profile deletion is already in progress", async () => {
    mocks.userGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ deletionPending: true }),
    });

    const result = await invoke("Bearer valid-token");

    expectRejected(result, 403, "FORBIDDEN", "Account deletion is in progress.");
  });

  it("authenticates a normal user and records auth_time", async () => {
    const result = await invoke("Bearer valid-token");

    expect(result.status).toBe(200);
    expect(result.req.authTime).toBe(validToken.auth_time);
    expect(result.req.authenticatedUser).toEqual({
      uid: "uid-123",
      email: "driver@example.test",
      displayName: "Test Driver",
      role: "USER",
      submitterStatus: "NONE",
    });
    expect(result.next).toHaveBeenCalledExactlyOnceWith();
  });

  it("uses the Firestore email when the Firebase token has no email", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({
      uid: "uid-123",
      auth_time: 1_700_000_000,
    });

    const result = await invoke("Bearer valid-token");

    expect(result.req.authenticatedUser?.email).toBe("profile@example.test");
    expect(result.next).toHaveBeenCalledExactlyOnceWith();
  });

  it("normalizes lowercase approved submitter state", async () => {
    mocks.userGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        name: "Approved Submitter",
        role: "SUBMITTER",
        submitterStatus: "approved",
      }),
    });

    const result = await invoke("Bearer valid-token");

    expect(result.req.authenticatedUser).toMatchObject({
      role: "SUBMITTER",
      submitterStatus: "APPROVED",
    });
    expect(result.next).toHaveBeenCalledExactlyOnceWith();
  });

  it("preserves administrators and defaults unknown statuses safely", async () => {
    mocks.userGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        name: "Admin",
        role: "ADMIN",
        submitterStatus: "unexpected-value",
      }),
    });

    const result = await invoke("Bearer valid-token");

    expect(result.req.authenticatedUser).toMatchObject({
      role: "ADMIN",
      submitterStatus: "NONE",
    });
    expect(result.next).toHaveBeenCalledExactlyOnceWith();
  });

  it("defaults unknown roles to USER", async () => {
    mocks.userGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        role: "SUPERUSER",
        submitterStatus: "PENDING",
      }),
    });

    const result = await invoke("Bearer valid-token");

    expect(result.req.authenticatedUser).toMatchObject({
      role: "USER",
      submitterStatus: "PENDING",
    });
    expect(result.next).toHaveBeenCalledExactlyOnceWith();
  });

  it("forwards unexpected authentication-service errors to Express", async () => {
    const error = new Error("Firestore unavailable");
    mocks.markerGet.mockRejectedValueOnce(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await invoke("Bearer valid-token");

    expect(result.next).toHaveBeenCalledWith(error);
    expect(consoleError).toHaveBeenCalledWith("Authentication service unavailable.");
    consoleError.mockRestore();
  });
});

describe("authenticate wired into the app", () => {
  const app = createApp();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("answers a missing token with the standard 401 envelope", async () => {
    const response = await request(app).get("/api/v1/submissions/mine");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Firebase ID token required.",
      },
    });
  });

  it("answers a pending account deletion with the standard 403 envelope", async () => {
    mocks.verifyIdToken.mockResolvedValue(validToken);
    mocks.deletionRequested.mockResolvedValue(true);

    const response = await request(app)
      .get("/api/v1/submissions/mine")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Account deletion has been requested.",
      },
    });
  });
});
