import { describe, expect, it } from "vitest";
import { submissionSchema, parseSubmissionEvent } from "./submissionValidation.js";

const common = {
  event_id: "evt_test_001",
  session_id: "TEST_R1_RACE",
  driver_id: "AAA",
  lap_number: 5,
  timestamp: "2026-09-09T12:00:00Z",
};
const lap = {
  ...common, type: "LAP_COMPLETED",
  payload: { lap_time_ms: 92481, position: 1, is_pit_lap: false, is_valid: true },
};

describe("submission event validation", () => {
  it("accepts a completed lap", () => {
    expect(parseSubmissionEvent(lap)).toEqual(lap);
  });

  it("accepts nullable timing and position for an invalid lap", () => {
    expect(parseSubmissionEvent({
      ...lap, payload: { ...lap.payload, lap_time_ms: null, position: null, is_valid: false },
    }).type).toBe("LAP_COMPLETED");
  });

  it("accepts all eight event types with their proper payloads", () => {
    const events = [
      { event_id: "start", session_id: common.session_id, timestamp: common.timestamp, type: "SESSION_START", payload: {} },
      { event_id: "end", session_id: common.session_id, timestamp: common.timestamp, type: "SESSION_END", payload: {} },
      lap,
      { ...common, type: "PIT_STOP", payload: { duration_ms: 2340, tyre_in: "medium", tyre_out: "hard" } },
      { ...common, type: "POSITION_CHANGE", payload: { overtaken_driver_id: "BBB", position_before: 2, position_after: 1 } },
      { ...common, type: "PENALTY_ISSUED", payload: { penalty_type: "TIME", duration_ms: 5000, reason: "Track limits" } },
      { ...common, type: "RETIREMENT", payload: { reason: "Engine failure" } },
      { ...common, type: "FASTEST_LAP_SET", payload: { lap_time_ms: 92481 } },
    ];
    for (const event of events) expect(submissionSchema.safeParse({ event }).success).toBe(true);
  });

  it("accepts non-time penalties with null duration", () => {
    for (const penalty_type of ["GRID_DROP", "DISQUALIFICATION"]) {
      expect(parseSubmissionEvent({
        ...common, type: "PENALTY_ISSUED",
        payload: { penalty_type, duration_ms: null, reason: "Steward decision" },
      }).type).toBe("PENALTY_ISSUED");
    }
  });

  it("accepts optional lap numbers for penalties and retirements", () => {
    const { lap_number: _lap, ...withoutLap } = common;
    expect(parseSubmissionEvent({
      ...withoutLap, type: "RETIREMENT", payload: { reason: "Mechanical" },
    }).type).toBe("RETIREMENT");
    expect(parseSubmissionEvent({
      ...withoutLap, type: "PENALTY_ISSUED",
      payload: { penalty_type: "GRID_DROP", duration_ms: null, reason: "Penalty" },
    }).type).toBe("PENALTY_ISSUED");
    expect(parseSubmissionEvent({
      ...withoutLap, lap_number: 0, type: "RETIREMENT", payload: { reason: "Start failure" },
    }).type).toBe("RETIREMENT");
  });

  it.each([
    ["missing event ID", { ...lap, event_id: "" }],
    ["missing session", { ...lap, session_id: "" }],
    ["bad timestamp", { ...lap, timestamp: "not-a-date" }],
    ["negative lap", { ...lap, lap_number: -1 }],
    ["fractional lap", { ...lap, lap_number: 1.5 }],
    ["negative time", { ...lap, payload: { ...lap.payload, lap_time_ms: -5 } }],
    ["fractional milliseconds", { ...lap, payload: { ...lap.payload, lap_time_ms: 2.5 } }],
    ["missing position", { ...lap, payload: { lap_time_ms: 1000, is_pit_lap: false, is_valid: true } }],
    ["unknown event type", { ...lap, type: "UNKNOWN" }],
    ["unexpected envelope field", { ...lap, role: "ADMIN" }],
    ["unexpected payload field", { ...lap, payload: { ...lap.payload, points: 25 } }],
    ["self overtake", { ...common, type: "POSITION_CHANGE", payload: { overtaken_driver_id: "AAA", position_before: 2, position_after: 1 } }],
    ["unchanged position", { ...common, type: "POSITION_CHANGE", payload: { overtaken_driver_id: "BBB", position_before: 2, position_after: 2 } }],
    ["missing penalty duration", { ...common, type: "PENALTY_ISSUED", payload: { penalty_type: "TIME", duration_ms: null, reason: "Penalty" } }],
    ["invalid non-time duration", { ...common, type: "PENALTY_ISSUED", payload: { penalty_type: "GRID_DROP", duration_ms: 5000, reason: "Penalty" } }],
    ["empty retirement reason", { ...common, type: "RETIREMENT", payload: { reason: "" } }],
    ["boundary with driver", { ...common, type: "SESSION_START", payload: {} }],
    ["boundary with data", { event_id: "start", session_id: common.session_id, timestamp: common.timestamp, type: "SESSION_START", payload: { points: 25 } }],
  ])("rejects %s", (_name, event) => {
    expect(submissionSchema.safeParse({ event }).success).toBe(false);
  });

  it("rejects extra top-level fields", () => {
    expect(submissionSchema.safeParse({ event: lap, role: "ADMIN" }).success).toBe(false);
  });
});
