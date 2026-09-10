// ---------------------------------------------------------------------------
// Jolpica-F1 response shapes.
//
// Jolpica serves the Ergast JSON envelope: everything is a string, including
// numbers, and every collection is optional because Ergast omits empty arrays
// rather than sending `[]`. Parsing with zod rather than a cast is what lets
// the rest of the pipeline work with real numbers under `strict` +
// `noUncheckedIndexedAccess` without a single `!` or `as`.
//
// Verified against api.jolpi.ca for season 2025 on 2026-09-10.
// ---------------------------------------------------------------------------

import { z } from "zod";

/** Ergast encodes every scalar as a string. */
const numericString = z
  .string()
  .regex(/^-?\d+$/, "expected an integer encoded as a string")
  .transform(Number);

/** `points` is the one field that is genuinely fractional (half points). */
const decimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "expected a number encoded as a string")
  .transform(Number);

export const jolpicaLocationSchema = z.object({
  locality: z.string().optional(),
  country: z.string(),
});

export const jolpicaCircuitSchema = z.object({
  circuitId: z.string(),
  circuitName: z.string(),
  Location: jolpicaLocationSchema.optional(),
});

export const jolpicaDriverSchema = z.object({
  driverId: z.string(),
  /**
   * Absent for reserve and test drivers. Those never appear in a result row,
   * but the schema stays honest about it and the mapper handles the gap.
   */
  code: z.string().optional(),
  permanentNumber: numericString.optional(),
  givenName: z.string(),
  familyName: z.string(),
  nationality: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

export const jolpicaConstructorSchema = z.object({
  constructorId: z.string(),
  name: z.string(),
  nationality: z.string().optional(),
});

const jolpicaLapTimeSchema = z.object({
  millis: numericString.optional(),
  time: z.string().optional(),
});

const jolpicaFastestLapSchema = z.object({
  rank: numericString.optional(),
  lap: numericString.optional(),
  Time: z.object({ time: z.string().optional() }).optional(),
});

/**
 * One classification row. `SprintResults` entries carry the same shape, which
 * is why a single schema covers both endpoints.
 */
export const jolpicaResultSchema = z.object({
  number: numericString.optional(),
  position: numericString,
  /**
   * Numeric for a classified finisher; a letter code otherwise ("R" retired,
   * "D" disqualified, "W" withdrawn, "N" not classified). This, not
   * `position`, is what says whether a finishing position is meaningful.
   */
  positionText: z.string(),
  points: decimalString,
  Driver: jolpicaDriverSchema,
  Constructor: jolpicaConstructorSchema,
  grid: numericString.optional(),
  laps: numericString.optional(),
  status: z.string(),
  Time: jolpicaLapTimeSchema.optional(),
  FastestLap: jolpicaFastestLapSchema.optional(),
});

export const jolpicaRaceSchema = z.object({
  season: z.string(),
  round: numericString,
  raceName: z.string(),
  Circuit: jolpicaCircuitSchema,
  date: z.string(),
  time: z.string().optional(),
  Results: z.array(jolpicaResultSchema).optional(),
  SprintResults: z.array(jolpicaResultSchema).optional(),
});

export const jolpicaRaceTableSchema = z.object({
  season: z.string().optional(),
  Races: z.array(jolpicaRaceSchema).default([]),
});

/**
 * The pagination envelope. `limit`, `offset` and `total` are what drive the
 * page loop -- and `limit` is the server's effective limit, which is not
 * necessarily the one that was requested (Jolpica silently caps it at 100).
 */
export const jolpicaEnvelopeSchema = z.object({
  MRData: z.object({
    limit: numericString,
    offset: numericString,
    total: numericString,
    RaceTable: jolpicaRaceTableSchema,
  }),
});

export type JolpicaDriver = z.infer<typeof jolpicaDriverSchema>;
export type JolpicaConstructor = z.infer<typeof jolpicaConstructorSchema>;
export type JolpicaResult = z.infer<typeof jolpicaResultSchema>;
export type JolpicaRace = z.infer<typeof jolpicaRaceSchema>;
export type JolpicaEnvelope = z.infer<typeof jolpicaEnvelopeSchema>;
