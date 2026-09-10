export type SubmissionStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface SubmissionEvent {
  event_id: string;
  session_id: string;
  driver_id?: string;
  type: "SESSION_START" | "SESSION_END" | "LAP_COMPLETED" | "PIT_STOP" |
    "POSITION_CHANGE" | "PENALTY_ISSUED" | "RETIREMENT" | "FASTEST_LAP_SET";
  lap_number?: number;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface SubmissionRecord {
  submission_id: number;
  submitter_user_id: number;
  submitted_by: string;
  submitted_by_email: string;
  session_id: string;
  status: SubmissionStatus;
  event_data: SubmissionEvent;
  validation_message: string | null;
  submitted_at: Date;
  reviewed_at: Date | null;
  reviewed_by: number | null;
  reviewed_by_uid: string | null;
  reviewed_by_email: string | null;
}
