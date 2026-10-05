// ---------------------------------------------------------------------------
// Per-constructor season statistics — docs/f1-statistics.md §3.
//
// Pure function: no express, no req/res, no file or database access.
//
// Constructor points are the sum of that constructor's own race_results rows
// for the season, grouped by each row's `race_results.constructor_id`.
//
// This does NOT compose buildDriverStatistics, and does NOT depend on a
// season lineup drawn from `driver_constructor_links`. Summing per driver
// required knowing which drivers belong to the constructor, and the only
// available answer was season-level with no date range — so a driver who
// changed teams mid-season had their WHOLE season credited to one team.
// Grouping the result rows themselves sidesteps that: each row already
// records the constructor the driver drove for in that race.
//
// Points remain the documented exception to "statistics are derived"
// (docs/ingestion/jolpica-ingestion.md §4.2): race_results.points is an
// ingested published fact that already applies the era, sprint and half-point
// rules services/pointsTable.ts does not implement. Summing published facts
// per constructor does not make the total any less published.
// ---------------------------------------------------------------------------

/** One race result's points, tagged with the constructor it was scored for. */
export interface ConstructorPointRow {
  constructor_id: string;
  driver_id: string;
  points: number;
}

export interface ConstructorStatisticsInput {
  constructor_id: string;
  season: string;
  /**
   * The season's RACE result rows, for ALL constructors — this function picks
   * out the ones belonging to `constructor_id`. Passing the whole season
   * rather than a pre-filtered slice is what makes the grouping rule visible
   * and testable here instead of hidden in a WHERE clause.
   */
  results: readonly ConstructorPointRow[];
}

export interface ConstructorStatistics {
  constructor_id: string;
  season: string;
  points: number | null;
}

export function buildConstructorStatistics(
  input: ConstructorStatisticsInput
): ConstructorStatistics {
  // Matched case-insensitively for the same reason constructors.model.ts's
  // findById is: an id can reach us in any case. The rows themselves come
  // from a column with a foreign key to constructors(constructor_id), so
  // their casing is already canonical.
  const target = input.constructor_id.toLowerCase();

  const ownRows = input.results.filter(
    (row) => row.constructor_id.toLowerCase() === target
  );

  return {
    constructor_id: input.constructor_id,
    season: input.season,

    // Null and 0 mean different things, matching the convention in
    // driverStatistics.ts: null is "no result rows for this constructor that
    // season" (no data), while 0 is "rows exist and they total nothing"
    // (a real, scoreless season). A team whose drivers all finished out of
    // the points must read 0, not "no data yet".
    points:
      ownRows.length > 0
        ? ownRows.reduce((sum, row) => sum + row.points, 0)
        : null,
  };
}

export interface ConstructorStanding {
  position: number;
  constructor_id: string;
  points: number;
}

export interface ConstructorStandings {
  season: string;
  standings: ConstructorStanding[];
}

/**
 * Every constructor's season points, highest first — the same per-row
 * grouping as buildConstructorStatistics, applied to all constructors at
 * once. Only constructors with at least one result row appear, so an empty
 * season yields an empty list rather than a table of zeros.
 *
 * Tied totals share a position (standard competition ranking) and are listed
 * by constructor_id. The official tie-break (count of best finishes) needs
 * per-race positions this input does not carry, so it is not guessed at.
 */
export function buildConstructorStandings(
  season: string,
  results: readonly ConstructorPointRow[]
): ConstructorStandings {
  const totals = new Map<string, number>();

  for (const row of results) {
    totals.set(row.constructor_id, (totals.get(row.constructor_id) ?? 0) + row.points);
  }

  const sorted = [...totals.entries()]
    .map(([constructor_id, points]) => ({ constructor_id, points }))
    .sort(
      (a, b) =>
        b.points - a.points || a.constructor_id.localeCompare(b.constructor_id)
    );

  const standings: ConstructorStanding[] = [];
  for (const [index, entry] of sorted.entries()) {
    const previous = standings[standings.length - 1];
    const position =
      previous !== undefined && previous.points === entry.points
        ? previous.position
        : index + 1;
    standings.push({ position, ...entry });
  }

  return { season, standings };
}
