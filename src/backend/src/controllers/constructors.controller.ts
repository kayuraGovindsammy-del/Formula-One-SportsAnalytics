import { z } from "zod";
import * as constructorsModel from "../models/constructors.model.js";
import {
  buildConstructorStandings,
  buildConstructorStatistics,
  type ConstructorStandings,
} from "../services/constructorStatistics.js";
import { ApiError } from "../middleware/ApiError.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { parseQuery, pathParam, seasonParam } from "../utils/queryValidation.js";

const constructorStatsQuery = z.object({
  season: seasonParam,
});

/** GET /api/v1/constructors/:constructor_id/stats — docs/api-design.md §4.9 */
export const getConstructorStats = asyncHandler(async (req, res) => {
  const constructorId = pathParam(req.params.constructor_id);
  const query = parseQuery(constructorStatsQuery, req.query);

  const constructor = await constructorsModel.findById(constructorId);

  if (!constructor) {
    throw ApiError.notFound(`Constructor '${constructorId}' was not found.`);
  }

  // The season's race results carry their own constructor_id per row, so the
  // team a driver scored for in each individual race is already recorded.
  // Nothing here consults driver_constructor_links: that table is
  // season-level with no date range, and using it meant a mid-season team
  // change credited a driver's whole season to a single team, while a team
  // with no link rows at all reported no points despite having results.
  const results = await constructorsModel.findSeasonPointRows(query.season);

  // Points are the documented exception to "statistics are derived"
  // (docs/ingestion/jolpica-ingestion.md §4.2, CLAUDE.md): race_results.points
  // is an ingested published fact that already applies the era, sprint and
  // half-point rules services/pointsTable.ts does not implement. Summing it
  // per constructor is reading published facts, not storing a total — nothing
  // is persisted, the sum happens per request.
  const statistics = buildConstructorStatistics({
    constructor_id: constructor.constructor_id,
    season: query.season,
    results,
  });

  res.status(200).json({ data: statistics, meta: {} });
});

/**
 * Every constructor's points for a season, highest first. Not exposed as a
 * route; used by the chat assistant's tools (chat/tools.ts).
 *
 * Sums the same published race_results.points as getConstructorStats, so the
 * two always agree — see the CLAUDE.md published-points exception.
 */
export async function getConstructorStandings(
  season: string
): Promise<ConstructorStandings> {
  const results = await constructorsModel.findSeasonPointRows(season);
  return buildConstructorStandings(season, results);
}
