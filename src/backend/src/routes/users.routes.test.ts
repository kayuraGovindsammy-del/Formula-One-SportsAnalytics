import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

const mocks = vi.hoisted(() => ({
  requestDeletion: vi.fn(),
}));

vi.mock("../services/accountDeletion.js", () => ({
  requestAccountDeletion: mocks.requestDeletion,
  deletionRequested: vi.fn().mockResolvedValue(false),
}));

vi.mock("../middleware/authenticate.js", () => ({
  authenticate: (req: {
    headers: { authorization?: string };
    authenticatedUser?: unknown;
    authTime?: number;
  }, res: { status: (status: number) => { json: (body: unknown) => void } },
  next: () => void) => {
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token) {
      res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication required." },
      });
      return;
    }
    req.authenticatedUser = {
      uid: "test-user",
      email: "test@example.test",
      displayName: "Test",
      role: "USER",
      submitterStatus: "NONE",
    };
    req.authTime = Math.floor(Date.now() / 1000) - (token === "stale" ? 600 : 0);
    next();
  },
}));

const app = createApp();

describe("DELETE /api/v1/users/me", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requestDeletion.mockResolvedValue(true);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).delete("/api/v1/users/me");
    expect(res.status).toBe(401);
    expect(mocks.requestDeletion).not.toHaveBeenCalled();
  });

  it("requires recent authentication", async () => {
    const res = await request(app).delete("/api/v1/users/me").auth("stale", { type: "bearer" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("RECENT_LOGIN_REQUIRED");
    expect(mocks.requestDeletion).not.toHaveBeenCalled();
  });

  it("deletes only the authenticated identity, not a supplied UID", async () => {
    const res = await request(app).delete("/api/v1/users/me")
      .auth("fresh", { type: "bearer" })
      .send({ uid: "another-user" });
    expect(res.status).toBe(204);
    expect(mocks.requestDeletion).toHaveBeenCalledWith("test-user");
  });

  it("returns 202 when durable cleanup is pending", async () => {
    mocks.requestDeletion.mockResolvedValue(false);
    const res = await request(app).delete("/api/v1/users/me").auth("fresh", { type: "bearer" });
    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe("deletion_pending");
  });
});
