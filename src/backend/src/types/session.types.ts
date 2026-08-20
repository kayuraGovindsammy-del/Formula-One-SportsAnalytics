// database/schema.sql `session_type` enum / docs/data-model.md Session entity.
export type SessionType =
  | "PRACTICE_1"
  | "PRACTICE_2"
  | "PRACTICE_3"
  | "QUALIFYING"
  | "SPRINT_QUALIFYING"
  | "SPRINT"
  | "RACE";

// database/schema.sql `sessions` table — the atomic unit laps/events attach to.
export interface Session {
  session_id: string;
  grand_prix_id: string;
  type: SessionType;
  total_laps: number | null;
  start_time: string | null;
  end_time: string | null;
}
