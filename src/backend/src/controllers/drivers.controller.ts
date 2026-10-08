import { z } from "zod";
import * as driversModel from "../models/drivers.model.js";
import * as eventsModel from "../models/events.model.js";
import * as lapsModel from "../models/laps.model.js";
import * as namesModel from "../models/names.model.js";
import * as raceResultsModel from "../models/raceResults.model.js";
import * as sessionsModel from "../models/sessions.model.js";
import {
  buildDriverStatistics,
  type DriverStatistics,
} from "../services/driverStatistics.js";
import { rankDrivers, type StandingsSort } from "../services/driverStandings.js";
import { ApiError } from "../middleware/ApiError.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  buildPaginationMeta,
  clampPerPage,
  DEFAULT_PER_PAGE,
} from "../utils/pagination.js";
import {
  optionalFilter,
  pageParam,
  parseQuery,
  pathParam,
  perPageParam,
  seasonParam,
} from "../utils/queryValidation.js";
import type { RaceResultRow } from "../models/raceResults.model.js";
import type { Event } from "../types/event.types.js";
import type { Lap } from "../types/lap.types.js";
import type { Session } from "../types/session.types.js";

const listDriversQuery = z.object({
  page: pageParam,
  per_page: perPageParam(DEFAULT_PER_PAGE),
  constructor_id: optionalFilter,
  nationality: optionalFilter,
  search: optionalFilter,
});

/** GET /api/v1/drivers — docs/api-design.md §4.1 */
export const listDrivers = asyncHandler(async (req, res) => {
  const query = parseQuery(listDriversQuery, req.query);
  const pageOptions = {
    page: query.page,
    per_page: clampPerPage(query.per_page),
  };

  const { rows, total_items } = await driversModel.findAll({
    ...pageOptions,
    constructor_id: query.constructor_id,
    nationality: query.nationality,
    search: query.search,
  });

  res.status(200).json({
    data: rows,
    meta: buildPaginationMeta(total_items, pageOptions),
  });
});

/** GET /api/v1/drivers/:driver_id — docs/api-design.md §4.2 */
export const getDriver = asyncHandler(async (req, res) => {
  const driverId = pathParam(req.params.driver_id);
  const driver = await driversModel.findById(driverId);

  if (!driver) {
    throw ApiError.notFound(`Driver '${driverId}' was not found.`);
  }

  res.status(200).json({ data: driver, meta: {} });
});

const driverStatsQuery = z.object({
  season: seasonParam,
});

/**
 * Everything season statistics are derived from, for every driver at once:
 * the season's RACE sessions with their laps, events (plus each race's
 * QUALIFYING events, for the starting grid) and stored classifications.
 *
 * Loaded in a fixed number of queries whatever the length of the calendar or
 * the number of drivers (routes/driverStats.queryCount.test.ts).
 */
export interface SeasonStatisticsData {
  season: string;
  raceSessions: Session[];
  qualifyingByGrandPrix: Map<string, Session>;
  lapsBySession: Map<string, Lap[]>;
  eventsBySession: Map<string, Event[]>;
  classificationBySession: Map<string, RaceResultRow[]>;
}

export async function loadSeasonStatisticsData(
  season: string
): Promise<SeasonStatisticsData> {
  const sessions = await sessionsModel.findBySeason(season);

  // Driver season statistics are race statistics.  QUALIFYING sessions are
  // supporting input only: their final LAP_COMPLETED positions provide the
  // starting grid used by positions_gained_lost_avg, but they must not count
  // as additional races entered.
  const raceSessions = sessions.filter((session) => session.type === "RACE");
  const qualifyingByGrandPrix = new Map(
    sessions
      .filter((session) => session.type === "QUALIFYING")
      .map((session) => [session.grand_prix_id, session])
  );

  // Everything this endpoint reads is loaded here, in a fixed number of
  // queries, and grouped by session in memory below. Loading it per race
  // instead made query volume scale with the length of the calendar.
  const raceSessionIds = raceSessions.map((session) => session.session_id);
  const eventSessionIds = [
    ...raceSessionIds,
    ...raceSessions
      .map((session) => qualifyingByGrandPrix.get(session.grand_prix_id))
      .filter((session): session is Session => session !== undefined)
      .map((session) => session.session_id),
  ];

  const [lapsBySession, eventsBySession, classificationBySession] =
    await Promise.all([
      lapsModel.findAllBySessions(raceSessionIds),
      eventsModel.findAllBySessions(eventSessionIds),
      raceResultsModel.findClassificationsBySessions(raceSessionIds),
    ]);

  return {
    season,
    raceSessions,
    qualifyingByGrandPrix,
    lapsBySession,
    eventsBySession,
    classificationBySession,
  };
}

/**
 * One driver's season statistics from already-loaded season data. Pure: no
 * I/O, so a whole grid can be derived from one load (loadDriverStandings).
 * `driverId` must be the canonical id.
 */
export function driverStatisticsFromSeason(
  driverId: string,
  data: SeasonStatisticsData
): DriverStatistics {
  const sessionInputs = data.raceSessions.map((session) => {
    const qualifyingSession = data.qualifyingByGrandPrix.get(session.grand_prix_id);

    // This driver's ingested race_results.points for this session, when a
    // row exists for them — passed through as stored_points so
    // buildDriverStatistics can prefer it over the derived scale
    // (docs/ingestion/jolpica-ingestion.md §4.2). undefined, not looked up
    // at all, when no such row exists.
    const storedResult = data.classificationBySession
      .get(session.session_id)
      ?.find((row) => row.driver_id.toLowerCase() === driverId.toLowerCase());

    return {
      session_id: session.session_id,
      laps: data.lapsBySession.get(session.session_id) ?? [],
      events: data.eventsBySession.get(session.session_id) ?? [],
      ...(qualifyingSession
        ? {
            qualifying_events:
              data.eventsBySession.get(qualifyingSession.session_id) ?? [],
          }
        : {}),
      ...(storedResult ? { stored_points: storedResult.points } : {}),
      // Fallback-only published facts (see DriverSessionInput): each is left
      // out when null, so buildDriverStatistics sees "unknown", not a value.
      ...(storedResult?.classified_position != null
        ? { stored_position: storedResult.classified_position }
        : {}),
      ...(storedResult?.grid_position != null
        ? { stored_grid_position: storedResult.grid_position }
        : {}),
      ...(storedResult?.fastest_lap_rank === 1
        ? { stored_fastest_lap: true }
        : {}),
    };
  });

  // Everything below this line is derived from the logs above, with one
  // deliberate exception: buildDriverStatistics prefers each session's
  // stored_points (race_results.points, an ingested published fact) over its
  // own from-scratch derivation when a row exists, and uses the stored
  // position / grid / fastest-lap rank only as fallbacks when a session has no
  // laps — see the doc comments on DriverSessionInput.
  return buildDriverStatistics({
    driver_id: driverId,
    season: data.season,
    sessions: sessionInputs,
  });
}

/**
 * Races in the season where the driver's published result is a
 * disqualification. The event log has no disqualification record, so the
 * published race_results status is the only source; counting those rows per
 * request is a published fact, like points (see CLAUDE.md). Disqualifications
 * are not DNFs (dnf_count counts retirements), so they are reported
 * separately. Not part of GET /drivers/:id/stats; the chat tools add it.
 */
export function disqualificationsFromSeason(
  driverId: string,
  data: SeasonStatisticsData
): number {
  return data.raceSessions.filter((session) =>
    (data.classificationBySession.get(session.session_id) ?? []).some(
      (row) =>
        row.driver_id.toLowerCase() === driverId.toLowerCase() && row.status === "DSQ"
    )
  ).length;
}

/**
 * A driver's season statistics plus their disqualifications, from one
 * season load. Returns null when the driver does not exist.
 */
export async function loadDriverSeason(
  driverId: string,
  season: string
): Promise<{ statistics: DriverStatistics; disqualifications: number } | null> {
  const driver = await driversModel.findById(driverId);

  if (!driver) {
    return null;
  }

  const data = await loadSeasonStatisticsData(season);
  return {
    statistics: driverStatisticsFromSeason(driver.driver_id, data),
    disqualifications: disqualificationsFromSeason(driver.driver_id, data),
  };
}

/**
 * Loads everything a driver's season statistics need and derives them.
 * Returns null when the driver does not exist.
 *
 * Exported so the chat assistant's tools (chat/tools.ts) read exactly the
 * same numbers as GET /drivers/:driver_id/stats. The query budget is fixed
 * regardless of calendar length (routes/driverStats.queryCount.test.ts).
 */
export async function loadDriverStatistics(
  driverId: string,
  season: string
): Promise<DriverStatistics | null> {
  return (await loadDriverSeason(driverId, season))?.statistics ?? null;
}

export interface DriverStanding {
  position: number;
  driver_id: string;
  driver_name: string;
  constructor_id: string | null;
  team_name: string | null;
  points: number | null;
  wins: number;
  podiums: number;
  fastest_laps: number;
  dnfs: number;
  average_finish_position: number | null;
  races_entered: number;
  disqualifications: number;
  /**
   * The driver's rank by points, whatever the table is sorted by, so a
   * points ranking is never inferred from a wins (or other) ranking. Null
   * when the driver has no points data.
   */
  points_position: number | null;
}

export interface StandingsLeader {
  driver_id: string;
  driver_name: string;
  team_name: string | null;
  points: number | null;
  wins: number;
}

export interface DriverStandingsResult {
  season: string;
  sort_by: StandingsSort;
  total_drivers: number;
  /** Who leads on points and on wins, over the whole field, not just the rows shown. */
  summary: { points_leader: StandingsLeader | null; wins_leader: StandingsLeader | null };
  standings: DriverStanding[];
}

/**
 * Every driver who raced in the season, ranked by `sortBy`. Not exposed as a
 * route; used by the chat assistant's get_driver_standings tool.
 *
 * Each driver's numbers come from driverStatisticsFromSeason over ONE season
 * load, so they are exactly what GET /drivers/:id/stats reports, with a
 * fixed number of queries however many drivers there are. A driver's team is
 * the constructor on their latest race result of the season (race_results
 * records the team per race; driver_constructor_links has no dates).
 */
export async function loadDriverStandings(
  season: string,
  sortBy: StandingsSort,
  limit: number
): Promise<DriverStandingsResult> {
  const [data, names] = await Promise.all([
    loadSeasonStatisticsData(season),
    namesModel.findNameDirectory(),
  ]);

  // Everyone with a result or a lap in the season, keyed case-insensitively;
  // the team is overwritten race by race, so the latest one remains.
  const teamByDriver = new Map<string, string | null>();
  for (const session of data.raceSessions) {
    for (const row of data.classificationBySession.get(session.session_id) ?? []) {
      teamByDriver.set(row.driver_id, row.constructor_id);
    }
    for (const lap of data.lapsBySession.get(session.session_id) ?? []) {
      if (!teamByDriver.has(lap.driver_id)) teamByDriver.set(lap.driver_id, null);
    }
  }

  const entries = [...teamByDriver.entries()].map(([driverId, constructorId]) => ({
    constructor_id: constructorId,
    statistics: driverStatisticsFromSeason(driverId, data),
    disqualifications: disqualificationsFromSeason(driverId, data),
  }));

  const driverName = (driverId: string) =>
    names.drivers.get(driverId.toUpperCase()) ?? driverId;
  const teamName = (constructorId: string | null) =>
    constructorId === null
      ? null
      : (names.constructors.get(constructorId.toUpperCase()) ?? constructorId);

  // The points ranking of the whole field, computed once and reported on every
  // row, so the model never has to guess it from another ranking.
  const pointsRanking = rankDrivers(entries, "points", entries.length);
  const pointsPosition = new Map(
    pointsRanking.map(({ position, entry }) => [
      entry.statistics.driver_id,
      entry.statistics.points === null ? null : position,
    ])
  );

  const leader = (sort: StandingsSort): StandingsLeader | null => {
    const top = (sort === "points" ? pointsRanking : rankDrivers(entries, sort, 1))[0];
    if (!top) return null;
    const { statistics } = top.entry;
    return {
      driver_id: statistics.driver_id,
      driver_name: driverName(statistics.driver_id),
      team_name: teamName(top.entry.constructor_id),
      points: statistics.points,
      wins: statistics.wins,
    };
  };

  const standings = rankDrivers(entries, sortBy, limit).map(({ position, entry }) => {
    const { statistics } = entry;
    return {
      position,
      driver_id: statistics.driver_id,
      driver_name: driverName(statistics.driver_id),
      constructor_id: entry.constructor_id,
      team_name: teamName(entry.constructor_id),
      points: statistics.points,
      points_position: pointsPosition.get(statistics.driver_id) ?? null,
      wins: statistics.wins,
      podiums: statistics.podiums,
      fastest_laps: statistics.fastest_laps,
      dnfs: statistics.dnf_count,
      average_finish_position: statistics.average_finish_position,
      races_entered: statistics.races_entered,
      disqualifications: entry.disqualifications,
    };
  });

  return {
    season,
    sort_by: sortBy,
    total_drivers: entries.length,
    summary: {
      points_leader: leader("points"),
      wins_leader: leader("wins"),
    },
    standings,
  };
}

/** GET /api/v1/drivers/:driver_id/stats — docs/api-design.md §4.3 */
export const getDriverStats = asyncHandler(async (req, res) => {
  const driverId = pathParam(req.params.driver_id);
  const query = parseQuery(driverStatsQuery, req.query);

  const statistics = await loadDriverStatistics(driverId, query.season);

  if (!statistics) {
    throw ApiError.notFound(`Driver '${driverId}' was not found.`);
  }

  res.status(200).json({ data: statistics, meta: {} });
});
