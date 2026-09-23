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
 * The drivers registered to this constructor for the given season, per
 * `driver_constructor_links` — docs/f1-statistics.md §3 ("both drivers
 * registered to that constructor for the season"). Unlike
 * drivers.model.ts's getConstructorIdByDriver, this is season-specific
 * rather than "latest team", since a past season's constructor points must
 * reflect that season's lineup.
 */
export async function findDriverIdsBySeason(
  constructorId: string,
  season: string
): Promise<string[]> {
  const result = await getPool().query<{ driver_id: string }>(
    `SELECT driver_id
       FROM driver_constructor_links
      WHERE LOWER(constructor_id) = LOWER($1)
        AND season_id = $2
      ORDER BY driver_id`,
    [constructorId, season]
  );

  return result.rows.map((row) => row.driver_id);
}
