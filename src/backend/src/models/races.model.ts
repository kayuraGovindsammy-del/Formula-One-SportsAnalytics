// ---------------------------------------------------------------------------
// SPRINT 1 PLACEHOLDER — backed by data/sample/races.json via sampleData.ts.
//
// This is replaced by Postgres queries joining `grand_prix`, `circuits` and
// `sessions` in database/schema.sql. The exported function signatures below are
// the contract that must survive that swap.
// ---------------------------------------------------------------------------

import {
  rawRaces,
  seasonId,
  toGrandPrixId,
  type RawRace,
} from "./sampleData.js";
import * as sessionsModel from "./sessions.model.js";
import { paginate, type PageOptions } from "../utils/pagination.js";
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

function toRace(raw: RawRace): Race {
  // Field order follows the example response in docs/api-design.md §4.4.
  return {
    grand_prix_id: toGrandPrixId(seasonId, raw.round),
    season_id: seasonId,
    round: raw.round,
    race_name: raw.race_name,
    circuit_id: raw.circuit_id,
    circuit_name: raw.circuit_name,
    locality: raw.locality,
    country: raw.country,
    date: raw.date,
    has_sprint: raw.has_sprint,
  };
}

function matchesFilters(raw: RawRace, filters: RaceFilters): boolean {
  if (filters.season !== undefined && seasonId !== filters.season) {
    return false;
  }

  if (filters.has_sprint !== undefined && raw.has_sprint !== filters.has_sprint) {
    return false;
  }

  if (filters.search !== undefined) {
    const needle = filters.search.toLowerCase();

    // Matches race_name / country / circuit_name per §6 — the same three
    // fields the frontend's existing client-side race filter searches.
    const matches =
      raw.race_name.toLowerCase().includes(needle) ||
      raw.country.toLowerCase().includes(needle) ||
      raw.circuit_name.toLowerCase().includes(needle);

    if (!matches) {
      return false;
    }
  }

  return true;
}

export async function findAll(options: FindAllRacesOptions): Promise<RacePage> {
  const matched = rawRaces.filter((raw) => matchesFilters(raw, options));
  const page = paginate(matched, options);

  const rows = await Promise.all(
    page.map(async (raw): Promise<RaceListItem> => {
      const race = toRace(raw);
      const sessions = await sessionsModel.findByRace(race.grand_prix_id);

      return {
        ...race,
        // has_results signals whether the statistics endpoint (§4.8) will have
        // anything to derive for this race — i.e. whether an event log exists.
        has_results: sessions.length > 0,
      };
    })
  );

  return { rows, total_items: matched.length };
}

function findRawById(grandPrixId: string): RawRace | undefined {
  return rawRaces.find(
    (raw) =>
      toGrandPrixId(seasonId, raw.round).toLowerCase() ===
      grandPrixId.toLowerCase()
  );
}

export async function findById(
  grandPrixId: string
): Promise<RaceDetail | null> {
  const raw = findRawById(grandPrixId);

  if (!raw) {
    return null;
  }

  const race = toRace(raw);

  return {
    ...race,
    sessions: await sessionsModel.findByRace(race.grand_prix_id),
  };
}

/**
 * Existence check used by the laps/events models to distinguish "this race does
 * not exist" (404) from "this race exists but has no event data" (empty list).
 */
export async function exists(grandPrixId: string): Promise<boolean> {
  return findRawById(grandPrixId) !== undefined;
}
