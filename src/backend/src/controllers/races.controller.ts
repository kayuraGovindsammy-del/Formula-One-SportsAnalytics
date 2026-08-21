import { z } from "zod";
import * as eventsModel from "../models/events.model.js";
import * as lapsModel from "../models/laps.model.js";
import * as racesModel from "../models/races.model.js";
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
