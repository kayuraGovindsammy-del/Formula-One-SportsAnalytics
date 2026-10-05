import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Response } from "express";
import { ApiError } from "./ApiError.js";
import type { AuthenticatedRequest } from "./authenticate.js";
import { requireAdmin, requireSubmitterOrAdmin } from "./authorization.js";
import type { AuthenticatedUser } from "../types/auth.types.js";

const base: AuthenticatedUser = {
  uid: "test-user",
  email: "test@example.test",
  displayName: "Test User",
  role: "USER",
  submitterStatus: "NONE",
};

function invoke(
  middleware: typeof requireAdmin,
  user?: AuthenticatedUser,
) {
  const req = { authenticatedUser: user } as AuthenticatedRequest;
  const json = vi.fn();
  const res = { status: vi.fn(), json } as unknown as Response;
  const next = vi.fn() as NextFunction;
  middleware(req, res, next);

  // A rejection is forwarded to errorHandler as an ApiError; a pass calls
  // next() with nothing. Either way the middleware never writes a response.
  expect(json).not.toHaveBeenCalled();
  const forwarded: unknown = vi.mocked(next).mock.calls[0]?.[0];
  const status = forwarded instanceof ApiError ? forwarded.httpStatus : 200;
  const error =
    forwarded instanceof ApiError
      ? { code: forwarded.code, message: forwarded.message }
      : undefined;

  return { status, error, next };
}

describe("API role authorization", () => {
  it("rejects unauthenticated admin requests", () => {
    const result = invoke(requireAdmin);
    expect(result.status).toBe(401);
    expect(result.error).toEqual({
      code: "UNAUTHENTICATED",
      message: "Authentication required.",
    });
  });

  it("rejects ordinary users and submitters from admin routes", () => {
    for (const role of ["USER", "SUBMITTER"] as const) {
      const result = invoke(requireAdmin, { ...base, role });
      expect(result.status).toBe(403);
      expect(result.error).toEqual({
        code: "FORBIDDEN",
        message: "Administrator access required.",
      });
    }
  });

  it("allows administrators to review submissions", () => {
    // next() with no argument: a rejection also calls next, but with an error.
    expect(invoke(requireAdmin, { ...base, role: "ADMIN" }).next)
      .toHaveBeenCalledExactlyOnceWith();
  });

  it("rejects unauthenticated submission requests", () => {
    expect(invoke(requireSubmitterOrAdmin).status).toBe(401);
  });

  it("rejects ordinary users and pending submitters", () => {
    expect(invoke(requireSubmitterOrAdmin, base).error).toEqual({
      code: "FORBIDDEN",
      message: "Approved submitter or administrator access required.",
    });
    expect(invoke(requireSubmitterOrAdmin, {
      ...base, role: "SUBMITTER", submitterStatus: "PENDING",
    }).status).toBe(403);
  });

  it("rejects rejected and non-approved submitters", () => {
    for (const submitterStatus of ["NONE", "REJECTED"] as const) {
      expect(invoke(requireSubmitterOrAdmin, {
        ...base, role: "SUBMITTER", submitterStatus,
      }).status).toBe(403);
    }
  });

  it("allows only approved submitters or administrators", () => {
    expect(invoke(requireSubmitterOrAdmin, {
      ...base, role: "SUBMITTER", submitterStatus: "APPROVED",
    }).next).toHaveBeenCalledExactlyOnceWith();
    expect(invoke(requireSubmitterOrAdmin, {
      ...base, role: "ADMIN",
    }).next).toHaveBeenCalledExactlyOnceWith();
  });
});
