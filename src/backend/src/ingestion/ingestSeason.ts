// ---------------------------------------------------------------------------
// Writes a SeasonIngestPlan into Postgres.
//
// Idempotent by construction: every statement is an upsert keyed on the
// primary key the schema already declares, and the whole season lands in one
// transaction. Running the same season twice produces the same rows and the
// same counts; running it after a schema.sql + seed.sql bootstrap updates the
// seeded rows in place rather than duplicating them.
// ---------------------------------------------------------------------------

import type { SeasonIngestPlan } from "./transform.js";

/**
 * The slice of pg.PoolClient this module uses. Narrowing it here is what lets
 * the tests exercise the real SQL-issuing code path against a recording fake
 * without a live database.
 */
export interface Queryable {
  query(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rowCount: number | null }>;
}

export interface IngestCounts {
  seasons: number;
  circuits: number;
  grand_prix: number;
  sessions: number;
  drivers: number;
  constructors: number;
  driver_constructor_links: number;
  race_results: number;
  qualifying_results: number;
  pit_stops: number;
  retirements: number;
}

export async function writeSeasonPlan(
  client: Queryable,
  plan: SeasonIngestPlan
): Promise<IngestCounts> {
  await client.query(
    `INSERT INTO seasons (season_id, year)
     VALUES ($1, $2)
     ON CONFLICT (season_id) DO UPDATE SET year = EXCLUDED.year`,
    [plan.season.season_id, plan.season.year]
  );

  for (const circuit of plan.circuits) {
    await client.query(
      `INSERT INTO circuits (circuit_id, circuit_name, locality, country)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (circuit_id) DO UPDATE SET
         circuit_name = EXCLUDED.circuit_name,
         locality = EXCLUDED.locality,
         country = EXCLUDED.country`,
      [
        circuit.circuit_id,
        circuit.circuit_name,
        circuit.locality,
        circuit.country,
      ]
    );
  }

  for (const constructor of plan.constructors) {
    await client.query(
      `INSERT INTO constructors (constructor_id, name, nationality)
       VALUES ($1, $2, $3)
       ON CONFLICT (constructor_id) DO UPDATE SET
         name = EXCLUDED.name,
         nationality = COALESCE(EXCLUDED.nationality, constructors.nationality)`,
      [constructor.constructor_id, constructor.name, constructor.nationality]
    );
  }

  for (const driver of plan.drivers) {
    await client.query(
      `INSERT INTO drivers (
         driver_id, permanent_number, given_name, family_name,
         nationality, date_of_birth
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (driver_id) DO UPDATE SET
         permanent_number = COALESCE(EXCLUDED.permanent_number, drivers.permanent_number),
         given_name = EXCLUDED.given_name,
         family_name = EXCLUDED.family_name,
         nationality = COALESCE(EXCLUDED.nationality, drivers.nationality),
         date_of_birth = COALESCE(EXCLUDED.date_of_birth, drivers.date_of_birth)`,
      [
        driver.driver_id,
        driver.permanent_number,
        driver.given_name,
        driver.family_name,
        driver.nationality,
        driver.date_of_birth,
      ]
    );
  }

  for (const race of plan.grandPrix) {
    await client.query(
      `INSERT INTO grand_prix (
         grand_prix_id, season_id, round, race_name,
         circuit_id, race_date, has_sprint
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (grand_prix_id) DO UPDATE SET
         season_id = EXCLUDED.season_id,
         round = EXCLUDED.round,
         race_name = EXCLUDED.race_name,
         circuit_id = EXCLUDED.circuit_id,
         race_date = EXCLUDED.race_date,
         has_sprint = EXCLUDED.has_sprint`,
      [
        race.grand_prix_id,
        race.season_id,
        race.round,
        race.race_name,
        race.circuit_id,
        race.race_date,
        race.has_sprint,
      ]
    );
  }

  for (const session of plan.sessions) {
    await client.query(
      `INSERT INTO sessions (session_id, grand_prix_id, type, total_laps)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id) DO UPDATE SET
         grand_prix_id = EXCLUDED.grand_prix_id,
         type = EXCLUDED.type,
         total_laps = COALESCE(EXCLUDED.total_laps, sessions.total_laps)`,
      [
        session.session_id,
        session.grand_prix_id,
        session.type,
        session.total_laps,
      ]
    );
  }

  // A driver holds exactly one team per season (see
  // resolveDriverConstructorLinks). Clearing the stale rows first is what
  // makes a re-run after a mid-season transfer converge instead of
  // accumulating: the PK is (season, driver, constructor), so a plain upsert
  // would leave the old team's row behind forever.
  for (const link of plan.driverConstructorLinks) {
    await client.query(
      `DELETE FROM driver_constructor_links
       WHERE season_id = $1 AND driver_id = $2 AND constructor_id <> $3`,
      [link.season_id, link.driver_id, link.constructor_id]
    );

    await client.query(
      `INSERT INTO driver_constructor_links (season_id, driver_id, constructor_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [link.season_id, link.driver_id, link.constructor_id]
    );
  }

  for (const result of plan.raceResults) {
    // pit_stops is deliberately absent from the update list. Jolpica's
    // results endpoint does not report it, so the ingest has no value for it;
    // writing the column's default would wipe the counts that seed.sql and
    // the derivation engine put there.
    await client.query(
      `INSERT INTO race_results (
         session_id, driver_id, constructor_id, position, grid_position,
         points, laps_completed, gap_to_winner_ms, fastest_lap_rank,
         fastest_lap_number, fastest_lap_time_ms, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (session_id, driver_id) DO UPDATE SET
         constructor_id = EXCLUDED.constructor_id,
         position = EXCLUDED.position,
         grid_position = EXCLUDED.grid_position,
         points = EXCLUDED.points,
         laps_completed = EXCLUDED.laps_completed,
         gap_to_winner_ms = COALESCE(EXCLUDED.gap_to_winner_ms, race_results.gap_to_winner_ms),
         fastest_lap_rank = COALESCE(EXCLUDED.fastest_lap_rank, race_results.fastest_lap_rank),
         fastest_lap_number = COALESCE(EXCLUDED.fastest_lap_number, race_results.fastest_lap_number),
         fastest_lap_time_ms = COALESCE(EXCLUDED.fastest_lap_time_ms, race_results.fastest_lap_time_ms),
         status = EXCLUDED.status`,
      [
        result.session_id,
        result.driver_id,
        result.constructor_id,
        result.position,
        result.grid_position,
        result.points,
        result.laps_completed,
        result.gap_to_winner_ms,
        result.fastest_lap_rank,
        result.fastest_lap_number,
        result.fastest_lap_time_ms,
        result.status,
      ]
    );
  }



  for (const result of plan.qualifyingResults) {
    await client.query(
      `INSERT INTO qualifying_results (
         session_id, driver_id, constructor_id, position,
         q1_time_ms, q2_time_ms, q3_time_ms
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (session_id, driver_id) DO UPDATE SET
         constructor_id = EXCLUDED.constructor_id,
         position = EXCLUDED.position,
         q1_time_ms = EXCLUDED.q1_time_ms,
         q2_time_ms = EXCLUDED.q2_time_ms,
         q3_time_ms = EXCLUDED.q3_time_ms`,
      [
        result.session_id,
        result.driver_id,
        result.constructor_id,
        result.position,
        result.q1_time_ms,
        result.q2_time_ms,
        result.q3_time_ms,
      ]
    );
  }

  // Replace only source-ingested pit stops. Approved submission rows carry a
  // non-null submission_id and are deliberately preserved.
  const raceSessionIds = plan.sessions
    .filter((session) => session.type === "RACE")
    .map((session) => session.session_id);

  for (const sessionId of raceSessionIds) {
    await client.query(
      `DELETE FROM pit_stops
       WHERE session_id = $1 AND submission_id IS NULL`,
      [sessionId]
    );
  }

  for (const stop of plan.pitStops) {
    // If an approved submission already represents the same stop, prefer that
    // reviewed record instead of double-counting it alongside source data.
    await client.query(
      `INSERT INTO pit_stops (
         session_id, driver_id, lap_number, duration_ms, submission_id
       )
       SELECT
         $1::varchar(70),
         $2::varchar(10),
         $3::integer,
         $4::integer,
         NULL::bigint
       WHERE NOT EXISTS (
         SELECT 1
         FROM pit_stops
         WHERE session_id = $1::varchar(70)
           AND driver_id = $2::varchar(10)
           AND lap_number = $3::integer
           AND submission_id IS NOT NULL
       )`,
      [stop.session_id, stop.driver_id, stop.lap_number, stop.duration_ms]
    );
  }

  // Rebuild source-derived retirements for each ingested race. Reviewed
  // submission rows are preserved. This also removes a stale source retirement
  // if upstream later corrects a result.
  for (const sessionId of raceSessionIds) {
    await client.query(
      `DELETE FROM retirements
       WHERE session_id = $1 AND submission_id IS NULL`,
      [sessionId]
    );
  }

  for (const retirement of plan.retirements) {
    await client.query(
      `INSERT INTO retirements (
         session_id, driver_id, lap_number, reason, submission_id
       )
       VALUES ($1, $2, $3, $4, NULL)
       ON CONFLICT (session_id, driver_id) DO UPDATE SET
         lap_number = EXCLUDED.lap_number,
         reason = EXCLUDED.reason
       WHERE retirements.submission_id IS NULL`,
      [
        retirement.session_id,
        retirement.driver_id,
        retirement.lap_number,
        retirement.reason,
      ]
    );
  }

  // Keep the denormalised pit-stop count in race_results aligned with the
  // event table. This includes both source-ingested and approved-submission
  // pit stops.
  for (const sessionId of raceSessionIds) {
    await client.query(
      `UPDATE race_results rr
       SET pit_stops = (
         SELECT COUNT(*)::int
         FROM pit_stops ps
         WHERE ps.session_id = rr.session_id
           AND ps.driver_id = rr.driver_id
       )
       WHERE rr.session_id = $1`,
      [sessionId]
    );
  }

  return {
    seasons: 1,
    circuits: plan.circuits.length,
    grand_prix: plan.grandPrix.length,
    sessions: plan.sessions.length,
    drivers: plan.drivers.length,
    constructors: plan.constructors.length,
    driver_constructor_links: plan.driverConstructorLinks.length,
    race_results: plan.raceResults.length,
    qualifying_results: plan.qualifyingResults.length,
    pit_stops: plan.pitStops.length,
    retirements: plan.retirements.length,
  };
}

export interface TransactionalClient extends Queryable {
  release(): void;
}

export interface Poolish {
  connect(): Promise<TransactionalClient>;
}

/** Wraps writeSeasonPlan in a transaction so a season is all-or-nothing. */
export async function ingestSeasonPlan(
  pool: Poolish,
  plan: SeasonIngestPlan
): Promise<IngestCounts> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const counts = await writeSeasonPlan(client, plan);
    await client.query("COMMIT");

    return counts;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
