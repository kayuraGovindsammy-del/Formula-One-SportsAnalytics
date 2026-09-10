import { getPool } from "../config/database.js";
import type { PageOptions } from "../utils/pagination.js";
import type { DriverRecord } from "../types/driver.types.js";

export interface DriverFilters {
  constructor_id?: string | undefined;
  nationality?: string | undefined;
  search?: string | undefined;
}

export type FindAllDriversOptions = DriverFilters & PageOptions;

export interface DriverPage {
  rows: DriverRecord[];
  total_items: number;
}

interface DriverSqlRow extends DriverRecord {
  total_items: number;
}

function offset(options: PageOptions): number {
  return (options.page - 1) * options.per_page;
}

export async function findAll(
  options: FindAllDriversOptions
): Promise<DriverPage> {
  const values: unknown[] = [];
  const where: string[] = [];

  if (options.constructor_id !== undefined) {
    values.push(options.constructor_id);
    where.push(`LOWER(dcl.constructor_id) = LOWER($${values.length})`);
  }

  if (options.nationality !== undefined) {
    values.push(options.nationality);
    where.push(`LOWER(d.nationality) = LOWER($${values.length})`);
  }

  if (options.search !== undefined) {
    values.push(`%${options.search}%`);
    const p = `$${values.length}`;
    where.push(`(
      d.given_name ILIKE ${p}
      OR d.family_name ILIKE ${p}
      OR (d.given_name || ' ' || d.family_name) ILIKE ${p}
    )`);
  }

  values.push(options.per_page);
  const limitParam = `$${values.length}`;

  values.push(offset(options));
  const offsetParam = `$${values.length}`;

  const result = await getPool().query<DriverSqlRow>(
    `
      WITH current_links AS (
        SELECT DISTINCT ON (driver_id)
          driver_id,
          constructor_id
        FROM driver_constructor_links
        ORDER BY driver_id, season_id DESC, constructor_id
      )
      SELECT
        d.driver_id,
        d.permanent_number,
        d.given_name,
        d.family_name,
        d.nationality,
        TO_CHAR(d.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        cl.constructor_id,
        c.name AS constructor_name,
        COUNT(*) OVER()::int AS total_items
      FROM drivers d
      JOIN current_links cl
        ON cl.driver_id = d.driver_id
      JOIN constructors c
        ON c.constructor_id = cl.constructor_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY d.driver_id
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `,
    values
  );

  return {
    rows: result.rows.map(({ total_items: _count, ...row }) => row),
    total_items: result.rows[0]?.total_items ?? 0,
  };
}

/**
 * Current/latest constructor lookup used by the statistics layer.
 * Historical season-specific mapping can be added later without changing
 * the drivers endpoint contract.
 */
export async function getConstructorIdByDriver(): Promise<Record<string, string>> {
  const result = await getPool().query<{
    driver_id: string;
    constructor_id: string;
  }>(
    `
      SELECT DISTINCT ON (driver_id)
        driver_id,
        constructor_id
      FROM driver_constructor_links
      ORDER BY driver_id, season_id DESC, constructor_id
    `
  );

  return Object.fromEntries(
    result.rows.map((row) => [row.driver_id, row.constructor_id])
  );
}

export async function findById(
  driverId: string
): Promise<DriverRecord | null> {
  const result = await getPool().query<DriverRecord>(
    `
      WITH current_link AS (
        SELECT constructor_id
        FROM driver_constructor_links
        WHERE LOWER(driver_id) = LOWER($1)
        ORDER BY season_id DESC, constructor_id
        LIMIT 1
      )
      SELECT
        d.driver_id,
        d.permanent_number,
        d.given_name,
        d.family_name,
        d.nationality,
        TO_CHAR(d.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        cl.constructor_id,
        c.name AS constructor_name
      FROM drivers d
      JOIN current_link cl ON TRUE
      JOIN constructors c
        ON c.constructor_id = cl.constructor_id
      WHERE LOWER(d.driver_id) = LOWER($1)
      LIMIT 1
    `,
    [driverId]
  );

  return result.rows[0] ?? null;
}
