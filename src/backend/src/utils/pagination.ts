import type { PaginationMeta } from "../types/api.types.js";

/** docs/api-design.md §5 — values above the max are clamped, not rejected. */
export const MAX_PER_PAGE = 100;

/** Default `per_page` for /drivers and /races. */
export const DEFAULT_PER_PAGE = 20;

/**
 * Default `per_page` for /laps and /events — a session's log is naturally
 * larger than a page of drivers or races.
 */
export const DEFAULT_PER_PAGE_LOG = 100;

export interface PageOptions {
  page: number;
  per_page: number;
}

export function clampPerPage(perPage: number): number {
  return Math.min(perPage, MAX_PER_PAGE);
}

/**
 * Slices an in-memory array. The Postgres replacement for this is LIMIT/OFFSET
 * inside the model's query — callers above the model layer never see either.
 */
export function paginate<T>(rows: readonly T[], options: PageOptions): T[] {
  const start = (options.page - 1) * options.per_page;
  return rows.slice(start, start + options.per_page);
}

export function buildPaginationMeta(
  totalItems: number,
  options: PageOptions
): PaginationMeta {
  return {
    page: options.page,
    per_page: options.per_page,
    total_items: totalItems,
    total_pages: Math.ceil(totalItems / options.per_page),
  };
}
