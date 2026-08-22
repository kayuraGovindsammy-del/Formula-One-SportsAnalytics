// ---------------------------------------------------------------------------
// Running order reconstruction.
//
// Pure functions: no express, no req/res, no file or database access.
//
// This is the clearest example of why the platform is event-sourced. NOTHING in
// the data model stores "who was in what position on lap N" — not the event
// log, not database/schema.sql, not the sample data. The order at a given lap
// exists only as the result of replaying POSITION_CHANGE events over a baseline
// order. Change one POSITION_CHANGE event and every lap after it re-derives
// automatically.
// ---------------------------------------------------------------------------

import type { Event, PositionChangePayload } from "../types/event.types.js";

interface PositionChange {
  lap_number: number;
  driver_id: string;
  overtaken_driver_id: string | null;
  position_before: number;
  position_after: number;
}

/**
 * Reads a POSITION_CHANGE into a checked shape. Payload fields are validated at
 * runtime rather than trusted — the event log is fed by user submissions, and a
 * malformed event must be skipped rather than corrupt the replay.
 */
function toPositionChange(event: Event): PositionChange | null {
  if (event.type !== "POSITION_CHANGE" || event.driver_id === undefined) {
    return null;
  }

  const payload = event.payload as PositionChangePayload;

  if (
    typeof payload.position_before !== "number" ||
    typeof payload.position_after !== "number" ||
    typeof event.lap_number !== "number"
  ) {
    return null;
  }

  return {
    lap_number: event.lap_number,
    driver_id: event.driver_id,
    overtaken_driver_id:
      typeof payload.overtaken_driver_id === "string"
        ? payload.overtaken_driver_id
        : null,
    position_before: payload.position_before,
    position_after: payload.position_after,
  };
}

function positionChangesInOrder(events: readonly Event[]): PositionChange[] {
  return events
    .map(toPositionChange)
    .filter((change): change is PositionChange => change !== null)
    .sort((a, b) => a.lap_number - b.lap_number); // stable: log order kept within a lap
}

/**
 * Reconstructs the baseline order the replay starts from.
 *
 * KNOWN LIMITATION — there is no starting grid in the event log
 * -------------------------------------------------------------
 * The true baseline is the starting grid, which comes from the QUALIFYING
 * session's classification. docs/api-design.md §9 already flags that no
 * qualifying data exists yet, so this function infers a baseline from the race
 * log instead:
 *
 *  1. For any driver named in a POSITION_CHANGE, use their EARLIEST such event:
 *     `position_before` if they were the overtaking driver, `position_after` if
 *     they were the one overtaken. Both describe where that driver sat *before*
 *     the change, so replaying that same event afterwards is not double-counting.
 *  2. For drivers who never appear in a POSITION_CHANGE, fall back to the
 *     position on their earliest LAP_COMPLETED event.
 *  3. Drivers with no positional evidence at all are absent from the result —
 *     they cannot be placed, and inventing a position would be a fabrication.
 *
 * Pass `startingOrder` explicitly (once qualifying data exists) to skip all of
 * this and get an exact replay.
 */
function inferBaselineOrder(events: readonly Event[]): string[] {
  const anchors = new Map<string, { lap: number; position: number }>();

  const consider = (driverId: string, lap: number, position: number): void => {
    const existing = anchors.get(driverId);

    if (existing === undefined || lap < existing.lap) {
      anchors.set(driverId, { lap, position });
    }
  };

  // Pass 1 — POSITION_CHANGE evidence takes precedence.
  for (const change of positionChangesInOrder(events)) {
    consider(change.driver_id, change.lap_number, change.position_before);

    if (change.overtaken_driver_id !== null) {
      // The overtaken driver held the position the mover ended up in.
      consider(
        change.overtaken_driver_id,
        change.lap_number,
        change.position_after
      );
    }
  }

  // Pass 2 — LAP_COMPLETED positions, only for drivers pass 1 didn't place.
  for (const event of events) {
    if (event.type !== "LAP_COMPLETED" || event.driver_id === undefined) {
      continue;
    }

    if (anchors.has(event.driver_id)) {
      continue;
    }

    const position = (event.payload as { position?: unknown }).position;

    if (typeof position === "number" && typeof event.lap_number === "number") {
      consider(event.driver_id, event.lap_number, position);
    }
  }

  return [...anchors.entries()]
    .sort(
      ([driverA, a], [driverB, b]) =>
        a.position - b.position || driverA.localeCompare(driverB)
    )
    .map(([driverId]) => driverId);
}

/**
 * The field order as at `lapNumber`, as an array of driver ids where index 0 is
 * P1, index 1 is P2, and so on.
 *
 * Replays every POSITION_CHANGE up to and including `lapNumber` over the
 * baseline order. An overtake is applied by lifting the moving driver out of
 * the order and re-inserting them at `position_after`, which pushes the driver
 * they passed (and anyone in between) back by one — so a multi-place move works
 * the same way a simple swap does.
 *
 * @param events        the session's event log
 * @param lapNumber     the lap to reconstruct the order as at; 0 or less yields
 *                      the baseline order itself
 * @param startingOrder optional true starting grid, best-to-worst. Supply this
 *                      when qualifying data is available; otherwise the
 *                      baseline is inferred (see inferBaselineOrder).
 */
export function runningOrderAtLap(
  events: readonly Event[],
  lapNumber: number,
  startingOrder?: readonly string[]
): string[] {
  const order =
    startingOrder !== undefined
      ? [...startingOrder]
      : inferBaselineOrder(events);

  for (const change of positionChangesInOrder(events)) {
    if (change.lap_number > lapNumber) {
      continue;
    }

    const currentIndex = order.indexOf(change.driver_id);

    if (currentIndex !== -1) {
      order.splice(currentIndex, 1);
    }

    // Clamp so a malformed position_after can't push a driver off the array.
    const targetIndex = Math.min(
      Math.max(change.position_after - 1, 0),
      order.length
    );

    order.splice(targetIndex, 0, change.driver_id);
  }

  return order;
}
