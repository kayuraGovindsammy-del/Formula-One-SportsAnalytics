// ---------------------------------------------------------------------------
// SPRINT 1 PLACEHOLDER — backed by data/sample/drivers.json via sampleData.ts.
//
// This is replaced by Postgres queries against the `drivers` / `constructors`
// tables in database/schema.sql. The exported function signatures below are the
// contract that must survive that swap: they are async, they take filter +
// page options, and they return { rows, total_items }. Controllers above this
// layer must not need to change.
// ---------------------------------------------------------------------------

import { getConstructorName } from "./constructors.model.js";
import { rawDrivers, type RawDriver } from "./sampleData.js";
import { paginate, type PageOptions } from "../utils/pagination.js";
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

function toDriverRecord(raw: RawDriver): DriverRecord {
  // Field order follows the example response in docs/api-design.md §4.1.
  return {
    driver_id: raw.driver_id,
    permanent_number: raw.permanent_number,
    given_name: raw.given_name,
    family_name: raw.family_name,
    nationality: raw.nationality,
    date_of_birth: raw.date_of_birth,
    constructor_id: raw.constructor_id,
    constructor_name: getConstructorName(raw.constructor_id),
  };
}

function matchesFilters(raw: RawDriver, filters: DriverFilters): boolean {
  if (
    filters.constructor_id !== undefined &&
    raw.constructor_id.toLowerCase() !== filters.constructor_id.toLowerCase()
  ) {
    return false;
  }

  if (
    filters.nationality !== undefined &&
    raw.nationality.toLowerCase() !== filters.nationality.toLowerCase()
  ) {
    return false;
  }

  if (filters.search !== undefined) {
    const needle = filters.search.toLowerCase();
    const fullName = `${raw.given_name} ${raw.family_name}`.toLowerCase();

    // Matches given_name/family_name per §6, and the combined name too, so a
    // search for "max verstappen" behaves the way the frontend's existing
    // client-side filter already does.
    const matches =
      raw.given_name.toLowerCase().includes(needle) ||
      raw.family_name.toLowerCase().includes(needle) ||
      fullName.includes(needle);

    if (!matches) {
      return false;
    }
  }

  return true;
}

export async function findAll(
  options: FindAllDriversOptions
): Promise<DriverPage> {
  const matched = rawDrivers.filter((raw) => matchesFilters(raw, options));

  return {
    rows: paginate(matched, options).map(toDriverRecord),
    total_items: matched.length,
  };
}

/**
 * driver_id -> constructor_id for the whole grid. The derivation services are
 * pure and do no data access, so the constructor lookup is fetched here and
 * handed to them.
 */
export async function getConstructorIdByDriver(): Promise<
  Record<string, string>
> {
  const lookup: Record<string, string> = {};

  for (const raw of rawDrivers) {
    lookup[raw.driver_id] = raw.constructor_id;
  }

  return lookup;
}

export async function findById(
  driverId: string
): Promise<DriverRecord | null> {
  // Case-insensitive so a lowercase URL (/drivers/ver) resolves the same as
  // the canonical uppercase code.
  const raw = rawDrivers.find(
    (candidate) => candidate.driver_id.toLowerCase() === driverId.toLowerCase()
  );

  return raw ? toDriverRecord(raw) : null;
}
