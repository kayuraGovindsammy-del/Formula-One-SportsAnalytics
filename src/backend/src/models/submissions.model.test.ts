import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubmissionRecord } from "../types/submission.types.js";
import type { AuthenticatedUser } from "../types/auth.types.js";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), connect: vi.fn(), release: vi.fn(),
}));
vi.mock("../config/database.js", () => ({
  getPool: () => ({ query: mocks.query, connect: mocks.connect }),
}));

import { create, review, findAll } from "./submissions.model.js";

const user: AuthenticatedUser = {
  uid: "alice", email: "alice@example.test", displayName: "Alice",
  role: "SUBMITTER", submitterStatus: "APPROVED",
};
const admin: AuthenticatedUser = { ...user, uid: "admin", role: "ADMIN", submitterStatus: "NONE" };
const event = {
  event_id: "evt_test_001", session_id: "TEST_R1_RACE", driver_id: "AAA",
  type: "LAP_COMPLETED" as const, lap_number: 1, timestamp: "2026-09-09T12:00:00Z",
  payload: { lap_time_ms: 92481, position: 1, is_pit_lap: false, is_valid: true },
};

describe("submission model transactions", () => {
  let statements: string[];
  let current: SubmissionRecord;
  let failLap = false;
  let duplicate = false;

  beforeEach(() => {
    vi.resetAllMocks();
    statements = [];
    failLap = false;
    duplicate = false;
    current = {
      submission_id: 1, submitter_user_id: 10, submitted_by: user.uid,
      submitted_by_email: user.email!, session_id: event.session_id,
      status: "PENDING", event_data: event, validation_message: null,
      submitted_at: new Date(), reviewed_at: null, reviewed_by: null,
      reviewed_by_uid: null, reviewed_by_email: null,
    };
    mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
    mocks.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      statements.push(sql);
      if (sql.includes("FROM account_deletions")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM sessions")) return { rows: [{ total_laps: 10 }], rowCount: 1 };
      if (sql.includes("FROM drivers")) return { rows: [], rowCount: 1 };
      if (sql.includes("FROM accepted_events") && sql.includes("UNION ALL"))
        return { rows: duplicate ? [{ one: 1 }] : [], rowCount: duplicate ? 1 : 0 };
      if (sql.includes("INSERT INTO users")) return { rows: [{ user_id: 10 }], rowCount: 1 };
      if (sql.includes("INSERT INTO submissions")) return { rows: [{ submission_id: 1 }], rowCount: 1 };
      if (sql.includes("FROM submissions") && sql.includes("FOR UPDATE"))
        return { rows: [{ status: current.status, event_data: current.event_data, submitter_user_id: 10 }], rowCount: 1 };
      if (sql.includes("INSERT INTO laps") && failLap) throw { code: "23505" };
      if (sql.includes("UPDATE submissions SET status")) {
        current = { ...current, status: params[1] as SubmissionRecord["status"],
          validation_message: params[2] as string | null,
          reviewed_at: new Date(), reviewed_by: 10 };
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SELECT") && sql.includes("s.submission_id"))
        return { rows: [current], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
  });

  it("creates a pending record without publishing normalized data", async () => {
    const created = await create(user, event);
    expect(created.status).toBe("PENDING");
    expect(statements.some(sql => sql.includes("INSERT INTO accepted_events"))).toBe(false);
    expect(statements.some(sql => sql.includes("INSERT INTO laps"))).toBe(false);
    expect(statements).toContain("COMMIT");
  });

  it("rejects duplicate event IDs before inserting", async () => {
    duplicate = true;
    await expect(create(user, event)).rejects.toMatchObject({ code: "DUPLICATE_EVENT", httpStatus: 409 });
    expect(statements.some(sql => sql.includes("INSERT INTO submissions"))).toBe(false);
    expect(statements).toContain("ROLLBACK");
  });

  it("publishes a lap and its envelope in the same review transaction", async () => {
    const result = await review(1, admin, "ACCEPTED", null);
    expect(result?.status).toBe("ACCEPTED");
    const envelope = statements.findIndex(sql => sql.includes("INSERT INTO accepted_events"));
    const lap = statements.findIndex(sql => sql.includes("INSERT INTO laps"));
    const status = statements.findIndex(sql => sql.includes("UPDATE submissions SET status"));
    expect(envelope).toBeGreaterThan(-1);
    expect(lap).toBeGreaterThan(envelope);
    expect(status).toBeGreaterThan(lap);
    expect(statements.at(-1)).toBe("COMMIT");
  });

  it("rolls back publication when a normalized record conflicts", async () => {
    failLap = true;
    await expect(review(1, admin, "ACCEPTED", null)).rejects.toMatchObject({ httpStatus: 409 });
    expect(statements).toContain("ROLLBACK");
    expect(statements.some(sql => sql.includes("UPDATE submissions SET status"))).toBe(false);
  });

  it("rejects a pending event without publishing any data", async () => {
    const result = await review(1, admin, "REJECTED", "Incorrect timing");
    expect(result?.status).toBe("REJECTED");
    expect(result?.validation_message).toBe("Incorrect timing");
    expect(statements.some(sql => sql.includes("INSERT INTO accepted_events"))).toBe(false);
  });

  it("does not allow the same submission to be reviewed twice", async () => {
    current.status = "ACCEPTED";
    await expect(review(1, admin, "REJECTED", "Late")).rejects.toMatchObject({
      code: "SUBMISSION_ALREADY_REVIEWED", httpStatus: 409,
    });
    expect(statements.some(sql => sql.includes("UPDATE submissions SET status"))).toBe(false);
  });

  it("revalidates stored events before approval", async () => {
    current.event_data = { ...event, payload: { lap_time_ms: -1 } };
    await expect(review(1, admin, "ACCEPTED", null)).rejects.toMatchObject({ httpStatus: 400 });
    expect(statements.some(sql => sql.includes("INSERT INTO accepted_events"))).toBe(false);
  });

  it("enforces administrator role even when called outside a route", async () => {
    await expect(review(1, user, "ACCEPTED", null)).rejects.toMatchObject({ httpStatus: 403 });
  });

  it("passes owner and status filters to PostgreSQL", async () => {
    await findAll("alice", "PENDING");
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("u.auth_uid = $1"), ["alice", "PENDING"]);
  });
});
