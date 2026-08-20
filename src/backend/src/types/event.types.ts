// The 8 event types from docs/event-schema.md §2.
export type EventType =
  | "SESSION_START"
  | "SESSION_END"
  | "LAP_COMPLETED"
  | "PIT_STOP"
  | "POSITION_CHANGE"
  | "PENALTY_ISSUED"
  | "RETIREMENT"
  | "FASTEST_LAP_SET";

export interface LapCompletedPayload {
  lap_time_ms: number;
  position: number;
  is_pit_lap: boolean;
  is_valid: boolean;
}

export interface PitStopPayload {
  duration_ms: number;
  tyre_in: string;
  tyre_out: string;
}

export interface PositionChangePayload {
  overtaken_driver_id: string;
  position_before: number;
  position_after: number;
}

export interface PenaltyIssuedPayload {
  penalty_type: "TIME" | "GRID_DROP" | "DISQUALIFICATION";
  duration_ms: number | null;
  reason: string;
}

export interface RetirementPayload {
  reason: string;
}

export interface FastestLapSetPayload {
  lap_time_ms: number;
}

// SESSION_START / SESSION_END carry an empty payload.
export type EmptyPayload = Record<string, never>;

export type EventPayload =
  | LapCompletedPayload
  | PitStopPayload
  | PositionChangePayload
  | PenaltyIssuedPayload
  | RetirementPayload
  | FastestLapSetPayload
  | EmptyPayload;

// The common envelope from docs/event-schema.md §3, matching
// data/sample/events.json entries. `driver_id` and `lap_number` are absent
// on SESSION_START/SESSION_END.
export interface Event {
  event_id: string;
  session_id: string;
  driver_id?: string;
  type: EventType;
  lap_number?: number;
  timestamp: string;
  payload: EventPayload;
}

// The race-weekend summary object at the top of data/sample/events.json —
// distinct from the `Session` entity in session.types.ts, which is the
// normalized database row.
export interface EventLogSessionSummary {
  session_id: string;
  round: number;
  race_name: string;
  type: string;
  date: string;
  total_laps: number;
}

export interface FastestLapResult {
  driver_id: string;
  lap_number: number;
  time_ms: number;
}

export interface ClassificationEntry {
  position: number;
  driver_id: string;
  constructor_id: string;
  laps: number;
  pit_stops: number;
  gap_to_winner_ms: number;
}

// data/sample/events.json `session_result` — the derived output the
// derivation engine reproduces from the event log rather than storing.
export interface SessionResult {
  pole_position?: string;
  fastest_lap: FastestLapResult;
  classification: ClassificationEntry[];
}
