import { getPool } from "../config/database.js";
import type { Constructor, DriverRecord } from "../types/driver.types.js";
import type { ResultStatus } from "../types/lap.types.js";
import type { RaceListItem } from "../types/race.types.js";
import type { SessionType } from "../types/session.types.js";

// ---------------------------------------------------------------------------
// Unpaginated reads for GET /api/v1/export/:dataset.
//
// Each function is exactly ONE query returning the whole filtered dataset —
// no per-row or per-race follow-ups — so an export's cost is flat however
// many races a season has. The paginated list models (races.model.ts,
// drivers.model.ts) are not reused because their LIMIT/OFFSET and
// COUNT(*) OVER() are baked into the SQL.
//
// Rows are published source records, not statistics: nothing here aggregates.
// `race_results.points` is exported per session as ingested, which is the
// published fact CLAUDE.md documents, not a stored total.
// ---------------------------------------------------------------------------

/** Same shape and ordering as GET /races, without pagination. */
export async function findRaces(
  season: string | undefined
): Promise<RaceListItem[]> {
  const values: unknown[] = [];
  let where = "";

  if (season !== undefined) {
    values.push(season);
    where = "WHERE gp.season_id = $1";
  }

  const result = await getPool().query<RaceListItem>(
    `
      SELECT
        gp.grand_prix_id,
        gp.season_id,
        gp.round,
        gp.race_name,
        gp.circuit_id,
        c.circuit_name,
        c.locality,
        c.country,
        TO_CHAR(gp.race_date, 'YYYY-MM-DD') AS date,
        gp.has_sprint,
        EXISTS (
          SELECT 1
          FROM sessions rs
          JOIN race_results rr
            ON rr.session_id = rs.session_id
          WHERE rs.grand_prix_id = gp.grand_prix_id
            AND rs.type = 'RACE'
        ) AS has_results
      FROM grand_prix gp
      JOIN circuits c
        ON c.circuit_id = gp.circuit_id
      ${where}
      ORDER BY gp.season_id DESC, gp.round
    `,
    values
  );

  return result.rows;
}

/**
 * Same shape as GET /drivers, one row per driver.
 *
 * With a season, only drivers linked to a team in that season, carrying that
 * season's team. Without one, every linked driver with their latest team —
 * exactly what GET /drivers returns. A driver linked to two teams in one
 * season resolves to the first by constructor_id, matching drivers.model.ts.
 */
export async function findDrivers(
  season: string | undefined
): Promise<DriverRecord[]> {
  const values: unknown[] = [];
  let linkWhere = "";

  if (season !== undefined) {
    values.push(season);
    linkWhere = "WHERE season_id = $1";
  }

  const result = await getPool().query<DriverRecord>(
    `
      WITH links AS (
        SELECT DISTINCT ON (driver_id)
          driver_id,
          constructor_id
        FROM driver_constructor_links
        ${linkWhere}
        ORDER BY driver_id, season_id DESC, constructor_id
      )
      SELECT
        d.driver_id,
        d.permanent_number,
        d.given_name,
        d.family_name,
        d.nationality,
        TO_CHAR(d.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        l.constructor_id,
        c.name AS constructor_name
      FROM drivers d
      JOIN links l
        ON l.driver_id = d.driver_id
      JOIN constructors c
        ON c.constructor_id = l.constructor_id
      ORDER BY d.driver_id
    `,
    values
  );

  return result.rows;
}

/**
 * Every constructor, or with a season, every constructor that took part in
 * it. "Took part" is a link row OR a result row in that season: CLAUDE.md
 * notes a team can have results without any driver_constructor_links row,
 * and filtering on links alone would silently drop it.
 */
export async function findConstructors(
  season: string | undefined
): Promise<Constructor[]> {
  const values: unknown[] = [];
  let where = "";

  if (season !== undefined) {
    values.push(season);
    where = `
      WHERE c.constructor_id IN (
        SELECT dcl.constructor_id
        FROM driver_constructor_links dcl
        WHERE dcl.season_id = $1
        UNION
        SELECT rr.constructor_id
        FROM race_results rr
        JOIN sessions s
          ON s.session_id = rr.session_id
        JOIN grand_prix gp
          ON gp.grand_prix_id = s.grand_prix_id
        WHERE gp.season_id = $1
      )
    `;
  }

  const result = await getPool().query<Constructor>(
    `
      SELECT
        c.constructor_id,
        c.name,
        c.nationality
      FROM constructors c
      ${where}
      ORDER BY c.constructor_id
    `,
    values
  );

  return result.rows;
}

export interface ResultExportRow {
  season_id: string;
  round: number;
  grand_prix_id: string;
  race_name: string;
  session_id: string;
  session_type: SessionType;
  position: number | null;
  driver_id: string;
  constructor_id: string;
  grid_position: number | null;
  laps_completed: number;
  pit_stops: number;
  status: ResultStatus;
  points: number;
  gap_to_winner_ms: number | null;
  fastest_lap_rank: number | null;
  fastest_lap_number: number | null;
  fastest_lap_time_ms: number | null;
}

interface ResultExportSqlRow extends Omit<ResultExportRow, "points"> {
  // NUMERIC(6,2): node-postgres returns it as a string (no OID 1700 parser
  // is registered), same as raceResults.model.ts.
  points: string;
}

/**
 * Every classification row in the season, across every session type that
 * has one (RACE and SPRINT). `position` is exported as stored — null for an
 * unclassified driver — rather than with raceResults.model.ts's positional
 * fallback, which is a display convenience, not source data.
 */
export async function findResults(season: string): Promise<ResultExportRow[]> {
  const result = await getPool().query<ResultExportSqlRow>(
    `
      SELECT
        gp.season_id,
        gp.round,
        gp.grand_prix_id,
        gp.race_name,
        rr.session_id,
        s.type AS session_type,
        rr.position,
        rr.driver_id,
        rr.constructor_id,
        rr.grid_position,
        rr.laps_completed,
        rr.pit_stops,
        rr.status,
        rr.points,
        rr.gap_to_winner_ms,
        rr.fastest_lap_rank,
        rr.fastest_lap_number,
        rr.fastest_lap_time_ms
      FROM race_results rr
      JOIN sessions s
        ON s.session_id = rr.session_id
      JOIN grand_prix gp
        ON gp.grand_prix_id = s.grand_prix_id
      WHERE gp.season_id = $1
      ORDER BY gp.round, s.type, rr.position NULLS LAST, rr.driver_id
    `,
    [season]
  );

  return result.rows.map((row) => ({ ...row, points: Number(row.points) }));
}

export interface LapExportRow {
  season_id: string;
  round: number;
  grand_prix_id: string;
  session_id: string;
  session_type: SessionType;
  driver_id: string;
  lap_number: number;
  lap_time_ms: number | null;
  position: number | null;
  is_pit_lap: boolean;
  is_valid: boolean;
}

/** Every persisted lap in the season, across every session. */
export async function findLaps(season: string): Promise<LapExportRow[]> {
  const result = await getPool().query<LapExportRow>(
    `
      SELECT
        gp.season_id,
        gp.round,
        gp.grand_prix_id,
        l.session_id,
        s.type AS session_type,
        l.driver_id,
        l.lap_number,
        l.lap_time_ms,
        l.position,
        l.is_pit_lap,
        l.is_valid
      FROM laps l
      JOIN sessions s
        ON s.session_id = l.session_id
      JOIN grand_prix gp
        ON gp.grand_prix_id = s.grand_prix_id
      WHERE gp.season_id = $1
      ORDER BY gp.round, s.type, l.driver_id, l.lap_number
    `,
    [season]
  );

  return result.rows;
}
