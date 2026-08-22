import { describe, expect, it } from "vitest";
import { pitStopCount, totalPitTime } from "./pitStatistics.js";
import * as eventsModel from "../models/events.model.js";
import type { Event } from "../types/event.types.js";

const SESSION_ID = "2025_R13_RACE";

function pitStopEvent(
  eventId: string,
  driverId: string,
  lapNumber: number,
  durationMs?: number
): Event {
  return {
    event_id: eventId,
    session_id: "TEST",
    driver_id: driverId,
    type: "PIT_STOP",
    lap_number: lapNumber,
    timestamp: null,
    payload: durationMs === undefined ? {} : { duration_ms: durationMs },
  } as Event;
}

function lapEvent(eventId: string, driverId: string): Event {
  return {
    event_id: eventId,
    session_id: "TEST",
    driver_id: driverId,
    type: "LAP_COMPLETED",
    lap_number: 1,
    timestamp: null,
    payload: {
      lap_time_ms: 100000,
      position: 1,
      is_pit_lap: false,
      is_valid: true,
    },
  };
}

describe("pitStopCount — hand-constructed", () => {
  it("counts only PIT_STOP events", () => {
    const events = [
      lapEvent("e1", "AAA"),
      pitStopEvent("e2", "AAA", 12, 2000),
      lapEvent("e3", "BBB"),
      pitStopEvent("e4", "BBB", 14, 2500),
    ];

    expect(pitStopCount(events)).toBe(2);
  });

  it("returns 0 for an empty log", () => {
    expect(pitStopCount([])).toBe(0);
  });

  it("returns 0 when nobody pitted", () => {
    expect(pitStopCount([lapEvent("e1", "AAA")])).toBe(0);
  });
});

describe("totalPitTime — hand-constructed", () => {
  it("sums pit stop durations", () => {
    // 2000 + 2500 = 4500
    const events = [
      pitStopEvent("e1", "AAA", 12, 2000),
      pitStopEvent("e2", "BBB", 14, 2500),
    ];

    expect(totalPitTime(events)).toBe(4500);
  });

  it("skips a stop whose duration was never recorded", () => {
    // Only the 2000ms stop has a duration, so the total is 2000 — not NaN.
    const events = [
      pitStopEvent("e1", "AAA", 12, 2000),
      pitStopEvent("e2", "BBB", 14),
    ];

    expect(totalPitTime(events)).toBe(2000);
  });

  it("returns null for an empty log", () => {
    expect(totalPitTime([])).toBeNull();
  });

  it("returns null when nobody pitted", () => {
    expect(totalPitTime([lapEvent("e1", "AAA")])).toBeNull();
  });

  it("returns null when no stop carries a duration", () => {
    expect(totalPitTime([pitStopEvent("e1", "AAA", 12)])).toBeNull();
  });
});

describe("pit statistics — real sample data", () => {
  it("counts the three pit stops in the Belgian GP log", async () => {
    // data/sample/events.json holds evt_005 (PIA, lap 18), evt_006 (NOR,
    // lap 19) and evt_007 (LEC, lap 17).
    const events = await eventsModel.findAllBySession(SESSION_ID);

    expect(pitStopCount(events)).toBe(3);
  });

  it("totals the pit time across those three stops", async () => {
    // 2400 (PIA) + 2350 (NOR) + 2500 (LEC) = 7250
    const events = await eventsModel.findAllBySession(SESSION_ID);

    expect(totalPitTime(events)).toBe(7250);
  });
});
