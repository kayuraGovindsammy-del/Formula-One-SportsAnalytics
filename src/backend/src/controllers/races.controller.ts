import { z } from "zod";
import * as driversModel from "../models/drivers.model.js";
import * as eventsModel from "../models/events.model.js";
import * as lapsModel from "../models/laps.model.js";
import * as racesModel from "../models/races.model.js"; 
import * as raceResultsModel from "../models/raceResults.model.js";
import { buildRaceStatistics } from "../services/raceStatistics.js";
import { ApiError } from "../middleware/ApiError.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  buildPaginationMeta,
  clampPerPage,
  DEFAULT_PER_PAGE,
  DEFAULT_PER_PAGE_LOG,
} from "../utils/pagination.js";
import {
  optionalFilter,
  pageParam,
  parseQuery,
  pathParam,
  perPageParam,
} from "../utils/queryValidation.js";

const SESSION_TYPES = [
  "PRACTICE_1",
  "PRACTICE_2",
  "PRACTICE_3",
  "QUALIFYING",
  "SPRINT_QUALIFYING",
  "SPRINT",
  "RACE",
] as const;

const EVENT_TYPES = [
  "SESSION_START",
  "SESSION_END",
  "LAP_COMPLETED",
  "PIT_STOP",
  "POSITION_CHANGE",
  "PENALTY_ISSUED",
  "RETIREMENT",
  "FASTEST_LAP_SET",
] as const;

const listRacesQuery = z.object({
  page: pageParam,
  per_page: perPageParam(DEFAULT_PER_PAGE),
  season: optionalFilter,
  has_sprint: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  search: optionalFilter,
});

const lapsQuery = z.object({
  page: pageParam,
  per_page: perPageParam(DEFAULT_PER_PAGE_LOG),
  driver_id: optionalFilter,
  session_type: z.enum(SESSION_TYPES).default("RACE"),
});

const eventsQuery = z.object({
  page: pageParam,
  per_page: perPageParam(DEFAULT_PER_PAGE_LOG),
  driver_id: optionalFilter,
  type: z.enum(EVENT_TYPES).optional(),
  session_type: z.enum(SESSION_TYPES).default("RACE"),
});

/** GET /api/v1/races — docs/api-design.md §4.4 */
export const listRaces = asyncHandler(async (req, res) => {
  const query = parseQuery(listRacesQuery, req.query);
  const pageOptions = {
    page: query.page,
    per_page: clampPerPage(query.per_page),
  };

  const { rows, total_items } = await racesModel.findAll({
    ...pageOptions,
    season: query.season,
    has_sprint: query.has_sprint,
    search: query.search,
  });

  res.status(200).json({
    data: rows,
    meta: buildPaginationMeta(total_items, pageOptions),
  });
});

/** GET /api/v1/races/:grand_prix_id — docs/api-design.md §4.5 */
export const getRace = asyncHandler(async (req, res) => {
  const grandPrixId = pathParam(req.params.grand_prix_id);
  const race = await racesModel.findById(grandPrixId);

  if (!race) {
    throw ApiError.notFound(`Race '${grandPrixId}' was not found.`);
  }

  res.status(200).json({ data: race, meta: {} });
});

/** GET /api/v1/races/:grand_prix_id/statistics — docs/api-design.md §4.8 */
export const getRaceStatistics = asyncHandler(async (req, res) => {
  const grandPrixId = pathParam(req.params.grand_prix_id);

  const race = await racesModel.findById(grandPrixId);

  if (!race) {
    throw ApiError.notFound(
      `Race '${grandPrixId}' was not found.`
    );
  }

  const session = race.sessions.find(
    (candidate) => candidate.type === "RACE"
  );

  if (!session) {
    throw ApiError.notFound(
      `No race session with event data exists for '${race.grand_prix_id}'.`
    );
  }

  const [
    laps,
    events,
    constructorIdByDriver,
    storedRaceResults,
  ] = await Promise.all([
    lapsModel.findAllBySession(session.session_id),
    eventsModel.findAllBySession(session.session_id),
    driversModel.getConstructorIdByDriver(),
    raceResultsModel.findByRace(grandPrixId),
  ]);

  const derivedStatistics =
    buildRaceStatistics({
      grand_prix_id: race.grand_prix_id,
      session_id: session.session_id,
      total_laps: session.total_laps,
      laps,
      events,
      constructor_id_by_driver:
        constructorIdByDriver,
    });

  /*
   * Prefer statistics derived from lap/event data whenever that derivation is
   * available.  This is important because derived rows can contain fields
   * (for example consistency_ms) that are not present in race_results.
   *
   * Real ingested seasons currently have race_results even when no complete
   * lap log has been ingested.  In that case the derived classification is
   * empty, so race_results is a data-availability fallback rather than an
   * override.  The same rule applies to fastest lap: use the derived value
   * first, then the stored Jolpica value only when no lap-derived value exists.
   */
  const statistics = {
    ...derivedStatistics,
    fastest_lap:
      derivedStatistics.fastest_lap ?? storedRaceResults?.fastest_lap ?? null,
    classification:
      derivedStatistics.classification.length > 0
        ? derivedStatistics.classification
        : (storedRaceResults?.classification.map((result) => ({
            position: result.position,
            driver_id: result.driver_id,
            constructor_id: result.constructor_id,
            laps: result.laps,
            pit_stops: result.pit_stops,
            consistency_ms: null,
            gap_to_winner_ms: result.gap_to_winner_ms,
            status: result.status,
          })) ?? []),
  };

  res.status(200).json({
    data: statistics,
    meta: {},
  });
});

/** GET /api/v1/races/:grand_prix_id/laps — docs/api-design.md §4.6 */
export const listRaceLaps = asyncHandler(async (req, res) => {
  const grandPrixId = pathParam(req.params.grand_prix_id);
  const query = parseQuery(lapsQuery, req.query);
  const pageOptions = {
    page: query.page,
    per_page: clampPerPage(query.per_page),
  };

  const result = await lapsModel.findByRace(grandPrixId, {
    ...pageOptions,
    driver_id: query.driver_id,
    session_type: query.session_type,
  });

  if (!result) {
    throw ApiError.notFound(`Race '${grandPrixId}' was not found.`);
  }

  res.status(200).json({
    data: result.rows,
    meta: buildPaginationMeta(result.total_items, pageOptions),
  });
});

/** GET /api/v1/races/:grand_prix_id/events — docs/api-design.md §4.7 */
export const listRaceEvents = asyncHandler(async (req, res) => {
  const grandPrixId = pathParam(req.params.grand_prix_id);
  const query = parseQuery(eventsQuery, req.query);
  const pageOptions = {
    page: query.page,
    per_page: clampPerPage(query.per_page),
  };

  const result = await eventsModel.findByRace(grandPrixId, {
    ...pageOptions,
    driver_id: query.driver_id,
    type: query.type,
    session_type: query.session_type,
  });

  if (!result) {
    throw ApiError.notFound(`Race '${grandPrixId}' was not found.`);
  }

  res.status(200).json({
    data: result.rows,
    meta: buildPaginationMeta(result.total_items, pageOptions),
  });
});
