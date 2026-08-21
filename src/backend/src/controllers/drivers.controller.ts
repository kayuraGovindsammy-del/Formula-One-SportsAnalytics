import { z } from "zod";
import * as driversModel from "../models/drivers.model.js";
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
