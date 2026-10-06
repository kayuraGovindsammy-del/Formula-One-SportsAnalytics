import { z, type ZodType } from "zod";
import { ApiError } from "../middleware/ApiError.js";

/**
 * Parses a request query against a zod schema, converting any failure into the
 * VALIDATION_ERROR shape from docs/api-design.md §2.
 *
 * `z.object()` strips unknown keys, which is what gives us the "unknown query
 * params are ignored, not rejected" behaviour required by §6.
 */
export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  const result = schema.safeParse(query);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => {
        const field = issue.path.join(".") || "query";
        return `'${field}': ${issue.message}`;
      })
      .join("; ");

    throw ApiError.validationError(`Invalid query parameter ${detail}`);
  }

  return result.data;
}

/**
 * Express 5 types path params as `string | string[]` to accommodate wildcard
 * routes. None of our routes use those, so this narrows to the single value.
 */
export function pathParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

/**
 * A trimmed optional string filter. An explicitly empty value (`?search=`) is
 * treated as "no filter" rather than a validation error — the frontend clearing
 * a search box shouldn't produce a 400.
 */
export const optionalFilter = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value === "" ? undefined : value));

/** A 1-indexed page number. Non-numeric or below 1 is a validation error. */
export const pageParam = z.coerce.number().int().min(1).default(1);

/**
 * `per_page` is validated as >= 1 here; the upper bound is *clamped* by
 * `clampPerPage` after parsing rather than rejected, per §5.
 */
export function perPageParam(defaultValue: number) {
  return z.coerce.number().int().min(1).default(defaultValue);
}

/**
 * A required season. Four digits, the same rule as /export's optional
 * `season`, so `?season=abc` is a 400 rather than an empty-but-valid season.
 */
export const seasonParam = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "Expected a four-digit season such as 2025");
