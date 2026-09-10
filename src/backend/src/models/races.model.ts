import { getPool } from "../config/database.js";
import * as sessionsModel from "./sessions.model.js";
import type { PageOptions } from "../utils/pagination.js";
import type { Race, RaceDetail, RaceListItem } from "../types/race.types.js";

export interface RaceFilters {
  season?: string | undefined;
  has_sprint?: boolean | undefined;
  search?: string | undefined;
}

export type FindAllRacesOptions = RaceFilters & PageOptions;

export interface RacePage {
  rows: RaceListItem[];
  total_items: number;
}

interface RaceSqlRow extends RaceListItem {
  total_items: number;
}

interface RaceDetailSqlRow extends Race {
  has_results: boolean;
}

function offset(options: PageOptions): number {
  return (options.page - 1) * options.per_page;
}

export async function findAll(options: FindAllRacesOptions): Promise<RacePage> {
  const values: unknown[] = [];
  const where: string[] = [];

  if (options.season !== undefined) {
    values.push(options.season);
    where.push(`gp.season_id = $${values.length}`);
  }

  if (options.has_sprint !== undefined) {
    values.push(options.has_sprint);
    where.push(`gp.has_sprint = $${values.length}`);
  }

  if (options.search !== undefined) {
    values.push(`%${options.search}%`);
    const p = `$${values.length}`;
    where.push(`(
      gp.race_name ILIKE ${p}
      OR c.country ILIKE ${p}
      OR c.circuit_name ILIKE ${p}
    )`);
  }

  values.push(options.per_page);
  const limitParam = `$${values.length}`;
  values.push(offset(options));
  const offsetParam = `$${values.length}`;

  const result = await getPool().query<RaceSqlRow>(
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
        ) AS has_results,
        COUNT(*) OVER()::int AS total_items
      FROM grand_prix gp
      JOIN circuits c
        ON c.circuit_id = gp.circuit_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY gp.season_id DESC, gp.round
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

export async function findById(grandPrixId: string): Promise<RaceDetail | null> {
  const result = await getPool().query<RaceDetailSqlRow>(
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
      WHERE LOWER(gp.grand_prix_id) = LOWER($1)
      LIMIT 1
    `,
    [grandPrixId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const { has_results: _hasResults, ...race } = row;

  return {
    ...race,
    sessions: await sessionsModel.findByRace(row.grand_prix_id),
  };
}

export async function exists(grandPrixId: string): Promise<boolean> {
  const result = await getPool().query(
    `
      SELECT 1
      FROM grand_prix
      WHERE LOWER(grand_prix_id) = LOWER($1)
      LIMIT 1
    `,
    [grandPrixId]
  );

  return Boolean(result.rowCount);
}
