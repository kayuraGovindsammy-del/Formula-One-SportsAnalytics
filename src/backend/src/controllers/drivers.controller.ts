import { z } from "zod";
import * as driversModel from "../models/drivers.model.js";
import * as eventsModel from "../models/events.model.js";
import * as lapsModel from "../models/laps.model.js";
import * as raceResultsModel from "../models/raceResults.model.js";
import * as sessionsModel from "../models/sessions.model.js";
import { buildDriverStatistics } from "../services/driverStatistics.js";
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
} from "../utils/queryValidation.js";
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
  season: z.string().trim().min(1),
});

/** GET /api/v1/drivers/:driver_id/stats — docs/api-design.md §4.3 */
export const getDriverStats = asyncHandler(async (req, res) => {
  const driverId = pathParam(req.params.driver_id);
  const query = parseQuery(driverStatsQuery, req.query);

  const driver = await driversModel.findById(driverId);

  if (!driver) {
    throw ApiError.notFound(`Driver '${driverId}' was not found.`);
  }

  const sessions = await sessionsModel.findBySeason(query.season);

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

  const sessionInputs = raceSessions.map((session) => {
    const qualifyingSession = qualifyingByGrandPrix.get(session.grand_prix_id);

    // This driver's ingested race_results.points for this session, when a
    // row exists for them — passed through as stored_points so
    // buildDriverStatistics can prefer it over the derived scale
    // (docs/ingestion/jolpica-ingestion.md §4.2). undefined, not looked up
    // at all, when no such row exists.
    const storedResult = classificationBySession
      .get(session.session_id)
      ?.find(
        (row) => row.driver_id.toLowerCase() === driver.driver_id.toLowerCase()
      );

    return {
      session_id: session.session_id,
      laps: lapsBySession.get(session.session_id) ?? [],
      events: eventsBySession.get(session.session_id) ?? [],
      ...(qualifyingSession
        ? {
            qualifying_events:
              eventsBySession.get(qualifyingSession.session_id) ?? [],
          }
        : {}),
      ...(storedResult ? { stored_points: storedResult.points } : {}),
    };
  });

  // Everything below this line is derived from the logs above, with one
  // deliberate exception: buildDriverStatistics prefers each session's
  // stored_points (race_results.points, an ingested published fact) over its
  // own from-scratch derivation when a row exists — see the doc comment on
  // DriverSessionInput.stored_points.
  const statistics = buildDriverStatistics({
    driver_id: driver.driver_id,
    season: query.season,
    sessions: sessionInputs,
  });

  res.status(200).json({ data: statistics, meta: {} });
});
