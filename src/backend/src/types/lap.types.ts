// Matches data/sample/laps.json entries (session_id lives at the file's top
// level there; the `laps` table in database/schema.sql carries it per row as
// part of the composite primary key, which is what's modeled here).
export interface Lap {
  session_id: string;
  driver_id: string;
  lap_number: number;
  lap_time_ms: number | null;
  position: number | null;
  is_pit_lap: boolean;
  is_valid: boolean;
}

// database/schema.sql `pit_stops` table.
export interface PitStop {
  pit_stop_id: number;
  session_id: string;
  driver_id: string;
  lap_number: number;
  duration_ms: number | null;
}

// database/schema.sql `position_changes` table.
export interface PositionChange {
  position_change_id: number;
  session_id: string;
  driver_id: string;
  overtaken_driver_id: string | null;
  lap_number: number;
  position_before: number;
  position_after: number;
}

// database/schema.sql `penalty_type` enum.
export type PenaltyType = "TIME" | "GRID_DROP" | "DISQUALIFICATION";

// database/schema.sql `penalties` table.
export interface Penalty {
  penalty_id: number;
  session_id: string;
  driver_id: string;
  lap_number: number | null;
  penalty_type: PenaltyType;
  duration_ms: number | null;
  reason: string | null;
}

// database/schema.sql `retirements` table.
export interface Retirement {
  retirement_id: number;
  session_id: string;
  driver_id: string;
  lap_number: number | null;
  reason: string | null;
}

// database/schema.sql `result_status` enum.
export type ResultStatus = "FINISHED" | "DNF" | "DSQ";

// database/schema.sql `race_results` table — derived, never entered directly.
export interface RaceResult {
  session_id: string;
  driver_id: string;
  constructor_id: string;
  position: number | null;
  points: number;
  laps_completed: number;
  status: ResultStatus;
}
