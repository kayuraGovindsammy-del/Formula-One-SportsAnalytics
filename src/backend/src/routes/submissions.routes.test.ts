import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), findAll: vi.fn(), findById: vi.fn(), review: vi.fn(),
}));

vi.mock("../models/submissions.model.js", () => mocks);
vi.mock("../middleware/authenticate.js", () => ({
  authenticate: (req: {
    headers: { authorization?: string };
    authenticatedUser?: unknown;
  }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token) {
      res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication required." },
      });
      return;
    }
    const [uid, role = "USER", submitterStatus = "NONE"] = token.split(":");
    req.authenticatedUser = {
      uid, role, submitterStatus, email: `${uid}@example.test`, displayName: uid,
    };
    next();
  },
}));

const app = createApp();
const event = {
  event_id: "evt_test_001", session_id: "TEST_R1_RACE", driver_id: "AAA",
  type: "LAP_COMPLETED", lap_number: 1, timestamp: "2026-09-09T12:00:00Z",
  payload: { lap_time_ms: 92481, position: 1, is_pit_lap: false, is_valid: true },
};
const record = {
  submission_id: 1, submitter_user_id: 10, submitted_by: "alice",
  submitted_by_email: "alice@example.test", session_id: event.session_id,
  status: "PENDING", event_data: event, validation_message: null,
  submitted_at: new Date(), reviewed_at: null, reviewed_by: null,
  reviewed_by_uid: null, reviewed_by_email: null,
};

describe("submission API authorization and validation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.create.mockResolvedValue(record);
    mocks.findAll.mockResolvedValue([record]);
    mocks.findById.mockResolvedValue(record);
    mocks.review.mockResolvedValue({ ...record, status: "ACCEPTED" });
  });

  it("rejects unauthenticated requests", async () => {
    expect((await request(app).post("/api/v1/submissions").send({ event })).status).toBe(401);
  });

  it("rejects ordinary and pending users from submission creation", async () => {
    for (const token of ["alice:USER:NONE", "alice:SUBMITTER:PENDING"]) {
      expect((await request(app).post("/api/v1/submissions")
        .auth(token, { type: "bearer" }).send({ event })).status).toBe(403);
    }
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("allows approved submitters to create validated events", async () => {
    const res = await request(app).post("/api/v1/submissions")
      .auth("alice:SUBMITTER:APPROVED", { type: "bearer" }).send({ event });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("rejects invalid payloads before reaching the database", async () => {
    const res = await request(app).post("/api/v1/submissions")
      .auth("alice:SUBMITTER:APPROVED", { type: "bearer" })
      .send({ event: { ...event, payload: { lap_time_ms: -1 } } });
    expect(res.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("passes the owner's UID into the SQL history query", async () => {
    const res = await request(app).get("/api/v1/submissions/mine")
      .auth("alice:USER:NONE", { type: "bearer" });
    expect(res.status).toBe(200);
    expect(mocks.findAll).toHaveBeenCalledWith("alice", undefined);
  });

  it("restricts non-admin listing even for approved submitters", async () => {
    const res = await request(app).get("/api/v1/submissions?status=pending")
      .auth("alice:SUBMITTER:APPROVED", { type: "bearer" });
    expect(res.status).toBe(200);
    expect(mocks.findAll).toHaveBeenCalledWith("alice", "PENDING");
  });

  it("allows administrators to list all submissions", async () => {
    await request(app).get("/api/v1/submissions").auth("admin:ADMIN:NONE", { type: "bearer" });
    expect(mocks.findAll).toHaveBeenCalledWith(undefined, undefined);
  });

  it("rejects access to another user's submission", async () => {
    const res = await request(app).get("/api/v1/submissions/1")
      .auth("bob:USER:NONE", { type: "bearer" });
    expect(res.status).toBe(403);
  });

  it("rejects invalid submission IDs and missing records", async () => {
    const bad = await request(app).get("/api/v1/submissions/0")
      .auth("alice:USER:NONE", { type: "bearer" });
    expect(bad.status).toBe(400);
    mocks.findById.mockResolvedValueOnce(null);
    const missing = await request(app).get("/api/v1/submissions/999")
      .auth("alice:USER:NONE", { type: "bearer" });
    expect(missing.status).toBe(404);
  });

  it("requires an administrator for review", async () => {
    const res = await request(app).patch("/api/v1/submissions/1")
      .auth("alice:SUBMITTER:APPROVED", { type: "bearer" })
      .send({ status: "accepted" });
    expect(res.status).toBe(403);
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it("requires a rejection reason", async () => {
    const res = await request(app).patch("/api/v1/submissions/1")
      .auth("admin:ADMIN:NONE", { type: "bearer" })
      .send({ status: "rejected", validation_errors: [] });
    expect(res.status).toBe(400);
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it("passes a valid review decision to the model", async () => {
    const res = await request(app).patch("/api/v1/submissions/1")
      .auth("admin:ADMIN:NONE", { type: "bearer" })
      .send({ status: "accepted", validation_errors: [] });
    expect(res.status).toBe(200);
    expect(mocks.review).toHaveBeenCalledWith(1, expect.objectContaining({ uid: "admin" }), "ACCEPTED", null);
  });
});
