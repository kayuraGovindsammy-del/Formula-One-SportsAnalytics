import { getPool } from "../config/database.js";
import type { Constructor } from "../types/driver.types.js";

/**
 * Resolve a constructor display name from PostgreSQL.
 * Falls back to the supplied id if the row is missing.
 */
export async function getConstructorName(constructorId: string): Promise<string> {
  const result = await getPool().query<{ name: string }>(
    `SELECT name
       FROM constructors
      WHERE LOWER(constructor_id) = LOWER($1)
      LIMIT 1`,
    [constructorId]
  );

  return result.rows[0]?.name ?? constructorId;
}

/**
 * Canonical constructor lookup, matched case-insensitively like
 * drivers.model.ts's findById. Returns null rather than falling back to the
 * supplied id, since the controller needs to tell "not found" apart from
 * "found" to return a 404 (docs/api-design.md §4.9).
 */
export async function findById(
  constructorId: string
): Promise<Constructor | null> {
  const result = await getPool().query<Constructor>(
    `SELECT constructor_id, name, nationality
       FROM constructors
      WHERE LOWER(constructor_id) = LOWER($1)
      LIMIT 1`,
    [constructorId]
  );

  return result.rows[0] ?? null;
}

/**
 * One race result row's points, tagged with the constructor the driver
 * actually drove for in THAT race.
 */
export interface ConstructorPointRow {
  constructor_id: string;
  driver_id: string;
  points: number;
}

/**
 * Every RACE result for the season, carrying each row's own
 * `race_results.constructor_id`.
 *
 * This is deliberately NOT filtered to one constructor and deliberately does
 * NOT touch `driver_constructor_links`. That table records season-level team
 * membership with no date range, so it cannot say which team a driver scored
 * for in a given race; `race_results.constructor_id` can, because it is
 * written per result row. Grouping these rows by that column is what makes a
 * mid-season team change attribute correctly, and what lets a constructor
 * with no link row still report its points.
 *
 * Returning the whole season and grouping in the pure service keeps that
 * attribution rule testable without a database. It is also strictly less I/O
 * than the lap-and-event fetch this replaced: ~480 narrow rows for a 24-race
 * season, one query, against 24 sessions' full lap and event logs before.
 *
 * `points` is NUMERIC(6,2) in schema.sql, which node-postgres returns as a
 * string (no OID 1700 parser is registered), so it is converted with Number()
 * here rather than trusted as a number — same as raceResults.model.ts.
 */
export async function findSeasonPointRows(
  season: string
): Promise<ConstructorPointRow[]> {
  const result = await getPool().query<{
    constructor_id: string;
    driver_id: string;
    points: string;
  }>(
    `SELECT rr.constructor_id, rr.driver_id, rr.points
       FROM race_results rr
       JOIN sessions s
         ON s.session_id = rr.session_id
       JOIN grand_prix gp
         ON gp.grand_prix_id = s.grand_prix_id
      WHERE gp.season_id = $1
        AND s.type = 'RACE'
      ORDER BY rr.constructor_id, rr.driver_id`,
    [season]
  );

  return result.rows.map((row) => ({
    constructor_id: row.constructor_id,
    driver_id: row.driver_id,
    points: Number(row.points),
  }));
}

export interface TeamDriverRow {
  driver_id: string;
  driver_name: string;
  /** RACE sessions this driver has a result in for this team that season. */
  races_entered: number;
}

/**
 * The drivers who raced for a constructor in a season, most races first.
 *
 * Read from race_results.constructor_id, which records the team per race, so
 * a mid-season swap shows both drivers with their own race counts.
 * driver_constructor_links is season-level with no dates and cannot say that.
 */
export async function findSeasonDrivers(
  constructorId: string,
  season: string
): Promise<TeamDriverRow[]> {
  const result = await getPool().query<TeamDriverRow>(
    `SELECT rr.driver_id,
            d.given_name || ' ' || d.family_name AS driver_name,
            COUNT(DISTINCT rr.session_id)::int AS races_entered
       FROM race_results rr
       JOIN sessions s
         ON s.session_id = rr.session_id
       JOIN grand_prix gp
         ON gp.grand_prix_id = s.grand_prix_id
       JOIN drivers d
         ON d.driver_id = rr.driver_id
      WHERE gp.season_id = $1
        AND s.type = 'RACE'
        AND LOWER(rr.constructor_id) = LOWER($2)
      GROUP BY rr.driver_id, d.given_name, d.family_name
      ORDER BY races_entered DESC, rr.driver_id`,
    [season, constructorId]
  );

  return result.rows;
}
