import { getPool } from "../config/database.js";

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
