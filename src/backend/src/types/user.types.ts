// database/schema.sql `user_role` enum.
export type UserRole = "USER" | "SUBMITTER" | "ADMIN";

// database/schema.sql `submitter_status` enum.
export type SubmitterStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

// database/schema.sql `users` table.
export interface User {
  user_id: number;
  auth_uid: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  submitter_status: SubmitterStatus;
  created_at: string;
  updated_at: string;
}

// database/schema.sql `submission_status` enum.
export type SubmissionStatus = "PENDING" | "ACCEPTED" | "REJECTED";

// database/schema.sql `submissions` table.
export interface Submission {
  submission_id: number;
  submitter_user_id: number;
  session_id: string;
  status: SubmissionStatus;
  source_filename: string | null;
  validation_message: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
}
