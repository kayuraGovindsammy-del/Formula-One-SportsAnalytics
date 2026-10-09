import { getPool } from "../config/database.js";

/**
 * Every driver's full name and every constructor's name, keyed by upper-case
 * id. Small (two tables of a few dozen rows), so callers load the whole
 * directory once instead of looking names up one id at a time.
 */
export interface NameDirectory {
  drivers: ReadonlyMap<string, string>;
  constructors: ReadonlyMap<string, string>;
}

/** One query for both tables. */
export async function findNameDirectory(): Promise<NameDirectory> {
  const result = await getPool().query<{
    kind: "driver" | "constructor";
    id: string;
    name: string;
  }>(
    `SELECT 'driver' AS kind, driver_id AS id,
            given_name || ' ' || family_name AS name
       FROM drivers
     UNION ALL
     SELECT 'constructor' AS kind, constructor_id AS id, name
       FROM constructors`
  );

  const drivers = new Map<string, string>();
  const constructors = new Map<string, string>();
  for (const row of result.rows) {
    (row.kind === "driver" ? drivers : constructors).set(row.id.toUpperCase(), row.name);
  }

  return { drivers, constructors };
}
