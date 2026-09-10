// ---------------------------------------------------------------------------
// Canonical entity identifiers.
//
// One definition, shared by the sample-data models and the Jolpica ingestion,
// so the API and the database cannot drift apart on how a race is named.
// ---------------------------------------------------------------------------

/**
 * `{season}_R{round}` with the round UNPADDED — `2025_R1`, not `2025_R01`.
 *
 * The convention comes from docs/data-model.md ("2025_R13") and is what the
 * API has always served. Zero-padding produces a distinct string for rounds
 * 1-9, which would mean two rows per race once an ingest and a seed disagree,
 * so the padding decision has to live in exactly one place: here.
 */
export function toGrandPrixId(season: string, round: number): string {
  return `${season}_R${round}`;
}

/** `{grand_prix_id}_{SESSION_TYPE}` — e.g. `2025_R13_RACE`. */
export function toSessionId(grandPrixId: string, sessionType: string): string {
  return `${grandPrixId}_${sessionType}`;
}
