import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Response } from "express";
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
  let status = 200;
  const json = vi.fn();
  const res = {
    status: vi.fn((value: number) => {
      status = value;
      return res;
    }),
    json,
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  middleware(req, res, next);
  return { status, json, next };
}

describe("API role authorization", () => {
  it("rejects unauthenticated admin requests", () => {
    const result = invoke(requireAdmin);
    expect(result.status).toBe(401);
    expect(result.next).not.toHaveBeenCalled();
  });

  it("rejects ordinary users and submitters from admin routes", () => {
    for (const role of ["USER", "SUBMITTER"] as const) {
      const result = invoke(requireAdmin, { ...base, role });
      expect(result.status).toBe(403);
    }
  });

  it("allows administrators to review submissions", () => {
    expect(invoke(requireAdmin, { ...base, role: "ADMIN" }).next).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated submission requests", () => {
    expect(invoke(requireSubmitterOrAdmin).status).toBe(401);
  });

  it("rejects ordinary users and pending submitters", () => {
    expect(invoke(requireSubmitterOrAdmin, base).status).toBe(403);
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
    }).next).toHaveBeenCalledOnce();
    expect(invoke(requireSubmitterOrAdmin, {
      ...base, role: "ADMIN",
    }).next).toHaveBeenCalledOnce();
  });
});
