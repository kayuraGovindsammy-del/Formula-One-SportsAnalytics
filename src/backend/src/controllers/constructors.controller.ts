import { z } from "zod";
import * as constructorsModel from "../models/constructors.model.js";
import * as eventsModel from "../models/events.model.js";
import * as lapsModel from "../models/laps.model.js";
import * as sessionsModel from "../models/sessions.model.js";
import { buildConstructorStatistics } from "../services/constructorStatistics.js";
import { ApiError } from "../middleware/ApiError.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { parseQuery, pathParam } from "../utils/queryValidation.js";

const constructorStatsQuery = z.object({
  season: z.string().trim().min(1),
});

/** GET /api/v1/constructors/:constructor_id/stats — docs/api-design.md §4.9 */
export const getConstructorStats = asyncHandler(async (req, res) => {
  const constructorId = pathParam(req.params.constructor_id);
  const query = parseQuery(constructorStatsQuery, req.query);

  const constructor = await constructorsModel.findById(constructorId);

  if (!constructor) {
    throw ApiError.notFound(`Constructor '${constructorId}' was not found.`);
  }

  // TODO(discrepancy): a driver who moved teams mid-season is linked to both
  // constructors for that season_id (driver_constructor_links has no date
  // range), so each team's total counts that driver's WHOLE season, not just
  // the races driven for it. No race-level team attribution exists yet to
  // fix this — see docs/f1-statistics.md §3.
  const driverIds = await constructorsModel.findDriverIdsBySeason(
    constructor.constructor_id,
    query.season
  );

  const sessions = await sessionsModel.findBySeason(query.season);

  // Constructor points are the sum of both drivers' season points
  // (docs/f1-statistics.md §3), which only needs RACE sessions — unlike
  // driver stats, nothing here depends on the qualifying-derived starting
  // grid, so QUALIFYING sessions are not fetched at all.
  const raceSessions = sessions.filter((session) => session.type === "RACE");

  // Fetched once per session and shared across both drivers rather than
  // once per driver — the underlying laps/events already carry every
  // driver's rows, same as buildDriverStatistics expects.
  const sessionInputs = await Promise.all(
    raceSessions.map(async (session) => {
      const [laps, events] = await Promise.all([
        lapsModel.findAllBySession(session.session_id),
        eventsModel.findAllBySession(session.session_id),
      ]);

      return { session_id: session.session_id, laps, events };
    })
  );

  // Everything below this line is derived from the logs above — nothing is
  // read from a stored total.
  //
  // TODO(discrepancy): unlike drivers.controller.ts's getDriverStats, this
  // does NOT pass stored_points through to buildConstructorStatistics (via
  // buildDriverStatistics), so a constructor's total stays purely derived
  // even for a fully Jolpica-ingested season with no lap log — where the
  // composed driver stats would each be null. Left out of scope when driver
  // stats gained this (see driverStatistics.ts's stored_points), tracked
  // here so the inconsistency isn't a surprise later.
  const statistics = buildConstructorStatistics({
    constructor_id: constructor.constructor_id,
    season: query.season,
    drivers: driverIds.map((driverId) => ({
      driver_id: driverId,
      sessions: sessionInputs,
    })),
  });

  res.status(200).json({ data: statistics, meta: {} });
});
