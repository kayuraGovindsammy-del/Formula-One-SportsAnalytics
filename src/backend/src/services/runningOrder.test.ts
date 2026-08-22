import { describe, expect, it } from "vitest";
import { runningOrderAtLap } from "./runningOrder.js";
import * as eventsModel from "../models/events.model.js";
import type { Event } from "../types/event.types.js";

const SESSION_ID = "2025_R13_RACE";

function positionChange(
  eventId: string,
  driverId: string,
  overtakenDriverId: string,
  lapNumber: number,
  positionBefore: number,
  positionAfter: number
): Event {
  return {
    event_id: eventId,
    session_id: "TEST",
    driver_id: driverId,
    type: "POSITION_CHANGE",
    lap_number: lapNumber,
    timestamp: null,
    payload: {
      overtaken_driver_id: overtakenDriverId,
      position_before: positionBefore,
      position_after: positionAfter,
    },
  };
}

describe("runningOrderAtLap — hand-constructed, explicit grid", () => {
  const grid = ["AAA", "BBB", "CCC"];

  it("returns the grid when no overtakes have happened", () => {
    expect(runningOrderAtLap([], 10, grid)).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("returns the grid at lap 0", () => {
    const events = [positionChange("e1", "BBB", "AAA", 3, 2, 1)];

    expect(runningOrderAtLap(events, 0, grid)).toEqual([
      "AAA",
      "BBB",
      "CCC",
    ]);
  });

  it("does not apply an overtake that hasn't happened yet", () => {
    // BBB passes AAA on lap 3, so at lap 2 the order is still the grid.
    const events = [positionChange("e1", "BBB", "AAA", 3, 2, 1)];

    expect(runningOrderAtLap(events, 2, grid)).toEqual([
      "AAA",
      "BBB",
      "CCC",
    ]);
  });

  it("applies an overtake on the lap it happened", () => {
    // BBB (P2) passes AAA (P1) on lap 3 -> BBB, AAA, CCC
    const events = [positionChange("e1", "BBB", "AAA", 3, 2, 1)];

    expect(runningOrderAtLap(events, 3, grid)).toEqual([
      "BBB",
      "AAA",
      "CCC",
    ]);
  });

  it("keeps the overtake applied on later laps", () => {
    const events = [positionChange("e1", "BBB", "AAA", 3, 2, 1)];

    expect(runningOrderAtLap(events, 40, grid)).toEqual([
      "BBB",
      "AAA",
      "CCC",
    ]);
  });

  it("handles a driver gaining two places at once", () => {
    // CCC goes P3 -> P1, pushing AAA and BBB back one each.
    const events = [positionChange("e1", "CCC", "AAA", 5, 3, 1)];

    expect(runningOrderAtLap(events, 5, grid)).toEqual([
      "CCC",
      "AAA",
      "BBB",
    ]);
  });

  it("replays several overtakes in lap order", () => {
    // Lap 3: BBB passes AAA      -> BBB, AAA, CCC
    // Lap 6: CCC passes AAA (P3->P2) -> BBB, CCC, AAA
    const events = [
      positionChange("e1", "BBB", "AAA", 3, 2, 1),
      positionChange("e2", "CCC", "AAA", 6, 3, 2),
    ];

    expect(runningOrderAtLap(events, 3, grid)).toEqual([
      "BBB",
      "AAA",
      "CCC",
    ]);
    expect(runningOrderAtLap(events, 6, grid)).toEqual([
      "BBB",
      "CCC",
      "AAA",
    ]);
  });

  it("replays events given out of order by lap number", () => {
    // Same two overtakes as above, supplied lap 6 first.
    const events = [
      positionChange("e2", "CCC", "AAA", 6, 3, 2),
      positionChange("e1", "BBB", "AAA", 3, 2, 1),
    ];

    expect(runningOrderAtLap(events, 6, grid)).toEqual([
      "BBB",
      "CCC",
      "AAA",
    ]);
  });

  it("returns an empty order when there is nothing to place", () => {
    expect(runningOrderAtLap([], 5)).toEqual([]);
  });
});

describe("runningOrderAtLap — real sample data, inferred baseline", () => {
  // The event log has no starting grid, so the baseline is inferred from the
  // earliest positional evidence: evt_004 records PIA at position_before 2 and
  // NOR (the overtaken driver) at position_after 1.
  //
  // Reference: Norris led from pole and Piastri passed him for the lead on
  // lap 5 of the 2025 Belgian GP — a real, independently known race fact.
  //
  // LEC and ANT are absent because nothing in events.json records a position
  // for them (evt_008, ANT's only LAP_COMPLETED, carries no position field).

  it("puts NOR ahead of PIA on lap 1, before the pass", async () => {
    const events = await eventsModel.findAllBySession(SESSION_ID);

    expect(runningOrderAtLap(events, 1)).toEqual(["NOR", "PIA"]);
  });

  it("still has NOR leading on lap 4", async () => {
    const events = await eventsModel.findAllBySession(SESSION_ID);

    expect(runningOrderAtLap(events, 4)).toEqual(["NOR", "PIA"]);
  });

  it("swaps them on lap 5, when Piastri took the lead", async () => {
    const events = await eventsModel.findAllBySession(SESSION_ID);

    expect(runningOrderAtLap(events, 5)).toEqual(["PIA", "NOR"]);
  });

  it("keeps Piastri ahead through to the end of the race", async () => {
    // PIA won and NOR finished second — matches the known race result.
    const events = await eventsModel.findAllBySession(SESSION_ID);

    expect(runningOrderAtLap(events, 44)).toEqual(["PIA", "NOR"]);
  });

  it("uses an explicit grid when one is supplied", async () => {
    // With the real grid supplied, LEC and VER are placed too, and the lap-5
    // pass still resolves correctly.
    const events = await eventsModel.findAllBySession(SESSION_ID);

    expect(
      runningOrderAtLap(events, 5, ["NOR", "PIA", "LEC", "VER"])
    ).toEqual(["PIA", "NOR", "LEC", "VER"]);
  });
});
