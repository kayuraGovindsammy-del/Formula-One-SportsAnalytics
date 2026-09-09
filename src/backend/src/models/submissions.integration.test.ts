import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg, { type Pool } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const state = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock("../config/database.js", () => ({
  getPool: () => {
    if (!state.pool) throw new Error("Isolated test pool is not initialized.");
    return state.pool;
  },
}));

import { create, review, findAll, findById } from "./submissions.model.js";
import type { AuthenticatedUser } from "../types/auth.types.js";
import type { SubmissionEvent } from "../types/submission.types.js";

const connectionString = process.env.TEST_DATABASE_URL;
let testUrl: URL | undefined;
if (connectionString) {
  testUrl = new URL(connectionString);
  const dbName = decodeURIComponent(testUrl.pathname.slice(1));
  if (!["localhost", "127.0.0.1", "[::1]"].includes(testUrl.hostname) ||
      !dbName.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL must point to a local PostgreSQL database whose name ends in _test. Never use Neon production.");
  }
}

const { Pool: PgPool } = pg;
let adminPool: Pool;
let schema = "";
const user = (uid: string, role: "USER" | "SUBMITTER" | "ADMIN" = "SUBMITTER"): AuthenticatedUser => ({
  uid, role, email: `${uid}@example.test`, displayName: uid,
  submitterStatus: role === "SUBMITTER" ? "APPROVED" : "NONE",
});
const admin = user("admin", "ADMIN");
let sequence = 0;
const nextId = () => `evt_integration_${++sequence}`;
const event = (overrides: Partial<SubmissionEvent> = {}): SubmissionEvent => {
  const value: SubmissionEvent = {
  event_id: nextId(), session_id: "TEST_R1_RACE", driver_id: "AAA",
  type: "LAP_COMPLETED", lap_number: 1, timestamp: "2026-09-09T12:00:00Z",
  payload: { lap_time_ms: 92481, position: 1, is_pit_lap: false, is_valid: true },
  ...overrides,
  };
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as unknown as SubmissionEvent;
};
const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

describe.skipIf(!testUrl)("isolated PostgreSQL submission integration", () => {
  beforeAll(async () => {
    if (!testUrl) return;
    adminPool = new PgPool({ connectionString: testUrl.toString(), max: 2 });
    schema = `member4_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await adminPool.query(`CREATE SCHEMA "${schema}"`);

    const scoped = new URL(testUrl.toString());
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    state.pool = new PgPool({ connectionString: scoped.toString(), max: 5 });
    const path = await state.pool.query<{ search_path: string }>("SHOW search_path");
    if (path.rows[0]?.search_path !== schema)
      throw new Error("Test schema isolation could not be verified.");

    await state.pool.query(source("../../../../database/schema.sql"));
    await state.pool.query(source("../../../../database/migrations/001_api_migration.sql"));
    await state.pool.query(source("../../../../database/migrations/002_account_deletion.sql"));
    await state.pool.query(source("../../../../database/migrations/003_submissions.sql"));
    await state.pool.query(`
      INSERT INTO seasons (season_id, year) VALUES ('2099', 2099);
      INSERT INTO circuits (circuit_id, circuit_name, country)
        VALUES ('TEST', 'Test Circuit', 'Testland');
      INSERT INTO constructors (constructor_id, name) VALUES ('TST', 'Test Team');
      INSERT INTO drivers (driver_id, given_name, family_name)
        VALUES ('AAA', 'Alice', 'Driver'), ('BBB', 'Bob', 'Driver');
      INSERT INTO grand_prix (grand_prix_id, season_id, round, race_name, circuit_id, race_date)
        VALUES ('TEST_R1', '2099', 1, 'Test Grand Prix', 'TEST', '2099-01-01');
      INSERT INTO sessions (session_id, grand_prix_id, type, total_laps)
        VALUES ('TEST_R1_RACE', 'TEST_R1', 'RACE', 10);
    `);
  }, 30000);

  afterAll(async () => {
    if (state.pool) await state.pool.end();
    if (adminPool) {
      if (schema) await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await adminPool.end();
    }
    state.pool = null;
  }, 30000);

  it("keeps pending events out of accepted and normalized tables", async () => {
    const created = await create(user("alice"), event());
    expect(created.status).toBe("PENDING");
    expect((await state.pool!.query("SELECT COUNT(*)::int AS n FROM accepted_events")).rows[0].n).toBe(0);
    expect((await state.pool!.query("SELECT COUNT(*)::int AS n FROM laps")).rows[0].n).toBe(0);
  });

  it("approves an event atomically with its normalized lap and reviewer", async () => {
    const created = await create(user("alice"), event({ lap_number: 2 }));
    const accepted = await review(created.submission_id, admin, "ACCEPTED", null);
    expect(accepted?.status).toBe("ACCEPTED");
    expect(accepted?.reviewed_by).not.toBeNull();
    expect(accepted?.reviewed_at).not.toBeNull();
    const published = await state.pool!.query(
      "SELECT submission_id, event_data FROM accepted_events WHERE event_id = $1",
      [created.event_data.event_id]
    );
    expect(published.rows[0].submission_id).toBe(created.submission_id);
    const laps = await state.pool!.query(
      "SELECT submission_id FROM laps WHERE session_id = $1 AND driver_id = $2 AND lap_number = 2",
      ["TEST_R1_RACE", "AAA"]
    );
    expect(laps.rows[0].submission_id).toBe(created.submission_id);
  });

  it("rejects duplicate event IDs and preserves the original", async () => {
    const first = await create(user("alice"), event({ lap_number: 3 }));
    await expect(create(user("bob"), { ...first.event_data })).rejects.toMatchObject({
      httpStatus: 409, code: "DUPLICATE_EVENT",
    });
  });

  it("rolls back approval when a normalized lap conflicts", async () => {
    const first = await create(user("alice"), event({ lap_number: 4 }));
    await review(first.submission_id, admin, "ACCEPTED", null);
    const second = await create(user("bob"), event({ lap_number: 4 }));
    await expect(review(second.submission_id, admin, "ACCEPTED", null)).rejects.toMatchObject({ httpStatus: 409 });
    expect((await findById(second.submission_id))?.status).toBe("PENDING");
    const published = await state.pool!.query("SELECT 1 FROM accepted_events WHERE event_id = $1", [second.event_data.event_id]);
    expect(published.rowCount).toBe(0);
  });

  it("records rejection without publishing and prevents a second review", async () => {
    const created = await create(user("alice"), event({ lap_number: 5 }));
    const rejected = await review(created.submission_id, admin, "REJECTED", "Incorrect timing");
    expect(rejected?.validation_message).toBe("Incorrect timing");
    await expect(review(created.submission_id, admin, "ACCEPTED", null)).rejects.toMatchObject({ httpStatus: 409 });
    expect((await state.pool!.query("SELECT 1 FROM accepted_events WHERE event_id = $1", [created.event_data.event_id])).rowCount).toBe(0);
  });

  it("publishes all supported event categories without inventing extra laps", async () => {
    const events = [
      event({ type: "SESSION_START", driver_id: undefined, lap_number: undefined, payload: {} }),
      event({ type: "PIT_STOP", lap_number: 6, payload: { duration_ms: 2340 } }),
      event({ type: "POSITION_CHANGE", lap_number: 7, payload: { overtaken_driver_id: "BBB", position_before: 2, position_after: 1 } }),
      event({ type: "PENALTY_ISSUED", lap_number: undefined, payload: { penalty_type: "TIME", duration_ms: 5000, reason: "Track limits" } }),
      event({ type: "RETIREMENT", lap_number: 8, payload: { reason: "Mechanical failure" } }),
      event({ type: "FASTEST_LAP_SET", lap_number: 2, payload: { lap_time_ms: 92481 } }),
      event({ type: "SESSION_END", driver_id: undefined, lap_number: undefined, payload: {} }),
    ];
    for (const item of events) {
      const created = await create(user("alice"), item);
      expect((await review(created.submission_id, admin, "ACCEPTED", null))?.status).toBe("ACCEPTED");
    }
    expect((await state.pool!.query("SELECT COUNT(*)::int AS n FROM pit_stops WHERE submission_id IS NOT NULL")).rows[0].n).toBe(1);
    expect((await state.pool!.query("SELECT COUNT(*)::int AS n FROM position_changes WHERE submission_id IS NOT NULL")).rows[0].n).toBe(1);
    expect((await state.pool!.query("SELECT COUNT(*)::int AS n FROM penalties WHERE submission_id IS NOT NULL")).rows[0].n).toBe(1);
    expect((await state.pool!.query("SELECT COUNT(*)::int AS n FROM retirements WHERE submission_id IS NOT NULL")).rows[0].n).toBe(1);
    expect((await state.pool!.query("SELECT COUNT(*)::int AS n FROM accepted_events")).rows[0].n).toBe(7 + 2);
  });

  it("filters history by owner and preserves reviewer metadata", async () => {
    const own = await findAll("alice");
    const other = await findAll("bob");
    expect(own.length).toBeGreaterThan(0);
    expect(own.every(row => row.submitted_by === "alice")).toBe(true);
    expect(other.every(row => row.submitted_by === "bob")).toBe(true);
    expect(own.some(row => row.reviewed_by_uid === "admin")).toBe(true);
  });

  it("blocks a tombstoned user from creating a new SQL identity", async () => {
    await state.pool!.query("INSERT INTO account_deletions (auth_uid) VALUES ($1)", ["deleted-test"]);
    await expect(create(user("deleted-test"), event({ lap_number: 9 })))
      .rejects.toMatchObject({ httpStatus: 403 });
  });

  it("serializes competing reviews so only one can succeed", async () => {
    const created = await create(user("alice"), event({ lap_number: 10 }));
    const results = await Promise.allSettled([
      review(created.submission_id, admin, "ACCEPTED", null),
      review(created.submission_id, admin, "REJECTED", "Competing decision"),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  }, 30000);
});
