import { z } from "zod";
import * as constructorsModel from "../models/constructors.model.js";
import * as eventsModel from "../models/events.model.js";
import * as lapsModel from "../models/laps.model.js";
import * as raceResultsModel from "../models/raceResults.model.js";
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
  // once per driver — the underlying laps/events and race_results
  // classification already carry every driver's rows, same as
  // buildDriverStatistics expects.
  const sessionData = await Promise.all(
    raceSessions.map(async (session) => {
      const [laps, events, raceResults] = await Promise.all([
        lapsModel.findAllBySession(session.session_id),
        eventsModel.findAllBySession(session.session_id),
        raceResultsModel.findByRace(session.grand_prix_id),
      ]);

      return { session_id: session.session_id, laps, events, raceResults };
    })
  );

  // Everything below this line is derived from the logs above, with one
  // deliberate exception: buildDriverStatistics (composed per driver below)
  // prefers each session's stored_points (race_results.points, an ingested
  // published fact) over its own from-scratch derivation when a row exists
  // for that driver — mirrors drivers.controller.ts's getDriverStats. See
  // the doc comment on DriverSessionInput.stored_points.
  const statistics = buildConstructorStatistics({
    constructor_id: constructor.constructor_id,
    season: query.season,
    drivers: driverIds.map((driverId) => ({
      driver_id: driverId,
      sessions: sessionData.map(({ raceResults, ...session }) => {
        const storedResult = raceResults?.classification.find(
          (row) => row.driver_id.toLowerCase() === driverId.toLowerCase()
        );

        return {
          ...session,
          ...(storedResult ? { stored_points: storedResult.points } : {}),
        };
      }),
    })),
  });

  res.status(200).json({ data: statistics, meta: {} });
});
