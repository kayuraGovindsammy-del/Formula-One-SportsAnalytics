import { z } from "zod";
import * as exportsModel from "../models/exports.model.js";
import { ApiError } from "../middleware/ApiError.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { toCsv } from "../utils/csv.js";
import {
  optionalFilter,
  parseQuery,
  pathParam,
} from "../utils/queryValidation.js";

interface LoadedDataset {
  rows: readonly unknown[];
  csv: () => string;
}

interface ExportDataset {
  load: (season: string | undefined) => Promise<LoadedDataset>;
}

/**
 * A dataset whose season filter is optional. `columns` fixes the CSV header
 * and field order; the JSON body is the model's rows as-is.
 */
function optionalSeason<Row>(
  columns: readonly (keyof Row & string)[],
  fetchRows: (season: string | undefined) => Promise<Row[]>
): ExportDataset {
  return {
    async load(season) {
      const rows = await fetchRows(season);
      return { rows, csv: () => toCsv(columns, rows) };
    },
  };
}

/**
 * A dataset that must be scoped to one season — a whole history of results
 * or laps in one response is not something the endpoint should offer.
 */
function requiredSeason<Row>(
  name: string,
  columns: readonly (keyof Row & string)[],
  fetchRows: (season: string) => Promise<Row[]>
): ExportDataset {
  return {
    async load(season) {
      if (season === undefined) {
        throw ApiError.validationError(
          `Invalid query parameter 'season': required for the '${name}' dataset`
        );
      }

      const rows = await fetchRows(season);
      return { rows, csv: () => toCsv(columns, rows) };
    },
  };
}

const DATASET_NAMES = [
  "races",
  "drivers",
  "constructors",
  "results",
  "laps",
] as const;

type DatasetName = (typeof DATASET_NAMES)[number];

const DATASETS: Record<DatasetName, ExportDataset> = {
  races: optionalSeason(
    [
      "grand_prix_id",
      "season_id",
      "round",
      "race_name",
      "circuit_id",
      "circuit_name",
      "locality",
      "country",
      "date",
      "has_sprint",
      "has_results",
    ],
    exportsModel.findRaces
  ),
  drivers: optionalSeason(
    [
      "driver_id",
      "permanent_number",
      "given_name",
      "family_name",
      "nationality",
      "date_of_birth",
      "constructor_id",
      "constructor_name",
    ],
    exportsModel.findDrivers
  ),
  constructors: optionalSeason(
    ["constructor_id", "name", "nationality"],
    exportsModel.findConstructors
  ),
  results: requiredSeason(
    "results",
    [
      "season_id",
      "round",
      "grand_prix_id",
      "race_name",
      "session_id",
      "session_type",
      "position",
      "driver_id",
      "constructor_id",
      "grid_position",
      "laps_completed",
      "pit_stops",
      "status",
      "points",
      "gap_to_winner_ms",
      "fastest_lap_rank",
      "fastest_lap_number",
      "fastest_lap_time_ms",
    ],
    exportsModel.findResults
  ),
  laps: requiredSeason(
    "laps",
    [
      "season_id",
      "round",
      "grand_prix_id",
      "session_id",
      "session_type",
      "driver_id",
      "lap_number",
      "lap_time_ms",
      "position",
      "is_pit_lap",
      "is_valid",
    ],
    exportsModel.findLaps
  ),
};

const datasetParam = z.enum(DATASET_NAMES);

const exportQuery = z.object({
  format: z.enum(["csv", "json"]).default("json"),
  season: optionalFilter.pipe(
    z
      .string()
      .regex(/^\d{4}$/, "Expected a four-digit season such as 2025")
      .optional()
  ),
});

/** GET /api/v1/export/:dataset — docs/datasets.md */
export const exportDataset = asyncHandler(async (req, res) => {
  const rawDataset = pathParam(req.params.dataset);
  const parsedDataset = datasetParam.safeParse(rawDataset);

  if (!parsedDataset.success) {
    throw ApiError.validationError(
      `Unknown dataset '${rawDataset}'. Expected one of: ${DATASET_NAMES.join(", ")}.`
    );
  }

  const dataset = parsedDataset.data;
  const query = parseQuery(exportQuery, req.query);
  const { rows, csv } = await DATASETS[dataset].load(query.season);

  // Both formats are sent as attachments. The frontend's download links are
  // cross-origin (the API is on a different host), and browsers ignore an
  // <a download> attribute across origins, so the header is what actually
  // makes "Download JSON" save a file rather than open it in a tab.
  // `dataset` is enum-checked and `season` is four digits, so neither can
  // inject into the header.
  const filename = `f1-${dataset}-${query.season ?? "all"}.${query.format}`;
  res.set("Content-Disposition", `attachment; filename="${filename}"`);

  if (query.format === "csv") {
    res.status(200).set("Content-Type", "text/csv; charset=utf-8").send(csv());
    return;
  }

  res.status(200).json({
    data: rows,
    meta: {
      dataset,
      season: query.season ?? null,
      row_count: rows.length,
      generated_at: new Date().toISOString(),
    },
  });
});
