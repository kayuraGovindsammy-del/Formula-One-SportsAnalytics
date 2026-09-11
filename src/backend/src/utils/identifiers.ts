// ---------------------------------------------------------------------------
// Canonical entity identifiers.
//
// One definition, shared by the sample-data models and the Jolpica ingestion,
// so the API and the database cannot drift apart on how a race is named.
// ---------------------------------------------------------------------------

/**
 * `{season}_R{round}` with the round zero-padded to two digits.
 *
 * Examples:
 * - round 1  -> `2025_R01`
 * - round 9  -> `2025_R09`
 * - round 13 -> `2025_R13`
 *
 * This matches database/seed.sql and the identifiers already stored in Neon.
 * Keeping this convention avoids creating a second ID for rounds 1-9 while
 * still preserving the existing two-digit IDs used throughout the project.
 */
export function toGrandPrixId(season: string, round: number): string {
  return `${season}_R${String(round).padStart(2, "0")}`;
}

/** `{grand_prix_id}_{SESSION_TYPE}` — e.g. `2025_R13_RACE`. */
export function toSessionId(grandPrixId: string, sessionType: string): string {
  return `${grandPrixId}_${sessionType}`;
}
