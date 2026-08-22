import { pool } from "../config/database.js";

import type { AuthenticatedUser } from "../types/auth.types.js";
import type {
  SubmissionEvent,
  SubmissionRecord,
  SubmissionStatus,
} from "../types/submission.types.js";

interface UserRow {
  user_id: number;
}

async function ensureDatabaseUser(
  user: AuthenticatedUser
): Promise<number> {
  const result = await pool.query<UserRow>(
    `
      INSERT INTO users (
        auth_uid,
        email,
        display_name,
        role,
        submitter_status
      )
      VALUES ($1, $2, $3, $4, $5)

      ON CONFLICT (auth_uid)
      DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        submitter_status = EXCLUDED.submitter_status,
        updated_at = NOW()

      RETURNING user_id
    `,
    [
      user.uid,
      user.email ?? `${user.uid}@firebase.local`,
      user.displayName,
      user.role,
      user.submitterStatus,
    ]
  );

  return result.rows[0]!.user_id;
}

export async function create(
  user: AuthenticatedUser,
  event: SubmissionEvent
): Promise<SubmissionRecord> {
  const userId = await ensureDatabaseUser(user);

  const result = await pool.query<SubmissionRecord>(
    `
      INSERT INTO submissions (
        submitter_user_id,
        session_id,
        status,
        event_data
      )
      VALUES ($1, $2, 'PENDING', $3::jsonb)

      RETURNING
        submission_id,
        submitter_user_id,
        $4::text AS submitted_by,
        $5::text AS submitted_by_email,
        session_id,
        status,
        event_data,
        validation_message,
        submitted_at,
        reviewed_at,
        reviewed_by
    `,
    [
      userId,
      event.session_id,
      JSON.stringify(event),
      user.uid,
      user.email ?? "",
    ]
  );

  return result.rows[0]!;
}

export async function findAll(): Promise<SubmissionRecord[]> {
  const result = await pool.query<SubmissionRecord>(
    `
      SELECT
        s.submission_id,
        s.submitter_user_id,
        u.auth_uid AS submitted_by,
        u.email AS submitted_by_email,
        s.session_id,
        s.status,
        s.event_data,
        s.validation_message,
        s.submitted_at,
        s.reviewed_at,
        s.reviewed_by
      FROM submissions s
      JOIN users u
        ON u.user_id = s.submitter_user_id
      ORDER BY s.submitted_at DESC
    `
  );

  return result.rows;
}

export async function findById(
  submissionId: number
): Promise<SubmissionRecord | null> {
  const result = await pool.query<SubmissionRecord>(
    `
      SELECT
        s.submission_id,
        s.submitter_user_id,
        u.auth_uid AS submitted_by,
        u.email AS submitted_by_email,
        s.session_id,
        s.status,
        s.event_data,
        s.validation_message,
        s.submitted_at,
        s.reviewed_at,
        s.reviewed_by
      FROM submissions s
      JOIN users u
        ON u.user_id = s.submitter_user_id
      WHERE s.submission_id = $1
    `,
    [submissionId]
  );

  return result.rows[0] ?? null;
}

export async function review(
  submissionId: number,
  admin: AuthenticatedUser,
  status: SubmissionStatus,
  validationMessage: string | null
): Promise<SubmissionRecord | null> {
  const adminUserId = await ensureDatabaseUser(admin);

  const result = await pool.query<SubmissionRecord>(
    `
      UPDATE submissions
      SET
        status = $2,
        validation_message = $3,
        reviewed_at = NOW(),
        reviewed_by = $4
      WHERE submission_id = $1
        AND status = 'PENDING'
      RETURNING
        submission_id,
        submitter_user_id,
        $5::text AS submitted_by,
        $6::text AS submitted_by_email,
        session_id,
        status,
        event_data,
        validation_message,
        submitted_at,
        reviewed_at,
        reviewed_by
    `,
    [
      submissionId,
      status,
      validationMessage,
      adminUserId,
      admin.uid,
      admin.email ?? "",
    ]
  );

  return result.rows[0] ?? null;
}