// ---------------------------------------------------------------------------
// SPRINT 1 PLACEHOLDER — derives sessions from data/sample/events.json.
//
// The sample data describes exactly one session (the 2025 Belgian GP race), so
// this model reconstructs a Session row from that file's `session` summary plus
// the SESSION_START / SESSION_END event timestamps.
//
// This is replaced by queries against the `sessions` table in
// database/schema.sql, where sessions are stored rows rather than derived. The
// function signatures below are the contract that must survive that swap.
// ---------------------------------------------------------------------------

import {
  rawEvents,
  rawSessionSummary,
  seasonId,
  toGrandPrixId,
} from "./sampleData.js";
import type { Session, SessionType } from "../types/session.types.js";

function buildSessions(): Session[] {
  const startEvent = rawEvents.find((event) => event.type === "SESSION_START");
  const endEvent = rawEvents.find((event) => event.type === "SESSION_END");

  return [
    {
      session_id: rawSessionSummary.session_id,
      grand_prix_id: toGrandPrixId(seasonId, rawSessionSummary.round),
      type: rawSessionSummary.type as SessionType,
      total_laps: rawSessionSummary.total_laps ?? null,
      start_time: startEvent?.timestamp ?? null,
      end_time: endEvent?.timestamp ?? null,
    },
  ];
}

// Built once at startup, alongside the one-time file load in sampleData.ts.
const sessions: readonly Session[] = buildSessions();

export async function findByRace(grandPrixId: string): Promise<Session[]> {
  return sessions.filter(
    (session) =>
      session.grand_prix_id.toLowerCase() === grandPrixId.toLowerCase()
  );
}

/**
 * Every session in a season, across all race weekends — the unit the driver
 * statistics endpoint aggregates over.
 */
export async function findBySeason(season: string): Promise<Session[]> {
  return sessions.filter((session) =>
    session.grand_prix_id.startsWith(`${season}_`)
  );
}

/** Resolves the single session of a given type within a race weekend. */
export async function findOneByRaceAndType(
  grandPrixId: string,
  type: SessionType
): Promise<Session | null> {
  const matches = await findByRace(grandPrixId);

  return matches.find((session) => session.type === type) ?? null;
}
