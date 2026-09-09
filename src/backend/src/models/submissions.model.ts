import type { PoolClient } from "pg";
import { getPool } from "../config/database.js";
import { ApiError } from "../middleware/ApiError.js";
import { parseSubmissionEvent, validationMessage } from "../services/submissionValidation.js";
import { z } from "zod";
import type { AuthenticatedUser } from "../types/auth.types.js";
import type { SubmissionEvent, SubmissionRecord, SubmissionStatus } from "../types/submission.types.js";

async function transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const value = await operation(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureDatabaseUser(client: PoolClient, user: AuthenticatedUser): Promise<number> {
  // Hold the UID lock until the enclosing submission transaction commits.
  // Account deletion uses the same lock and its durable tombstone.
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [user.uid]);
  const deleting = await client.query(
    "SELECT 1 FROM account_deletions WHERE auth_uid = $1", [user.uid]
  );
  if (deleting.rowCount) throw ApiError.forbidden("Account deletion has been requested.");
  const result = await client.query<{ user_id: number }>(
    `INSERT INTO users (auth_uid, email, display_name, role, submitter_status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (auth_uid) DO UPDATE SET
       email = EXCLUDED.email, display_name = EXCLUDED.display_name,
       role = EXCLUDED.role, submitter_status = EXCLUDED.submitter_status,
       updated_at = NOW()
     RETURNING user_id`,
    [user.uid, user.email ?? `${user.uid}@firebase.local`,
      user.displayName, user.role, user.submitterStatus]
  );
  return result.rows[0]!.user_id;
}

const columns = `s.submission_id, s.submitter_user_id,
  u.auth_uid AS submitted_by, u.email AS submitted_by_email,
  s.session_id, s.status, s.event_data, s.validation_message,
  s.submitted_at, s.reviewed_at, s.reviewed_by,
  reviewer.auth_uid AS reviewed_by_uid, reviewer.email AS reviewed_by_email`;
const joins = `FROM submissions s
  JOIN users u ON u.user_id = s.submitter_user_id
  LEFT JOIN users reviewer ON reviewer.user_id = s.reviewed_by`;

async function readRecord(client: PoolClient, id: number): Promise<SubmissionRecord> {
  const result = await client.query<SubmissionRecord>(
    `SELECT ${columns} ${joins} WHERE s.submission_id = $1`, [id]
  );
  return result.rows[0]!;
}

export async function findAll(ownerUid?: string, status?: SubmissionStatus): Promise<SubmissionRecord[]> {
  const result = await getPool().query<SubmissionRecord>(
    `SELECT ${columns} ${joins}
     WHERE ($1::text IS NULL OR u.auth_uid = $1)
       AND ($2::text IS NULL OR s.status::text = $2)
     ORDER BY s.submitted_at DESC, s.submission_id DESC`,
    [ownerUid ?? null, status ?? null]
  );
  return result.rows;
}

export async function findById(id: number): Promise<SubmissionRecord | null> {
  const result = await getPool().query<SubmissionRecord>(
    `SELECT ${columns} ${joins} WHERE s.submission_id = $1`, [id]
  );
  return result.rows[0] ?? null;
}

async function validateReferences(client: PoolClient, event: SubmissionEvent): Promise<void> {
  const session = await client.query<{ total_laps: number | null }>(
    "SELECT total_laps FROM sessions WHERE session_id = $1", [event.session_id]
  );
  if (!session.rows[0]) throw ApiError.validationError("Unknown session_id.");
  if (event.lap_number !== undefined && session.rows[0].total_laps !== null &&
      event.lap_number > session.rows[0].total_laps)
    throw ApiError.validationError("Lap number exceeds the session total.");
  const ids = [event.driver_id];
  if (event.type === "POSITION_CHANGE")
    ids.push(event.payload.overtaken_driver_id as string);
  for (const id of ids.filter((value): value is string => Boolean(value))) {
    const result = await client.query("SELECT 1 FROM drivers WHERE driver_id = $1", [id]);
    if (!result.rowCount) throw ApiError.validationError(`Unknown driver_id: ${id}.`);
  }
}

async function lockEvent(client: PoolClient, eventId: string): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`event:${eventId}`]);
}

async function assertUniqueEvent(client: PoolClient, eventId: string): Promise<void> {
  const found = await client.query(
    `SELECT 1 FROM accepted_events WHERE event_id = $1
     UNION ALL
     SELECT 1 FROM submissions
     WHERE event_data->>'event_id' = $1 AND status IN ('PENDING', 'ACCEPTED')
     LIMIT 1`, [eventId]
  );
  if (found.rowCount)
    throw ApiError.conflict("DUPLICATE_EVENT", "This event ID is already pending or accepted.");
}

function databaseError(error: unknown): never {
  if (error instanceof z.ZodError)
    throw ApiError.validationError(validationMessage(error));
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code) : "";
  if (code === "23505")
    throw ApiError.conflict("DUPLICATE_EVENT", "This event conflicts with an existing event or normalized record.");
  if (code === "23503" || code === "23514" || code === "23502")
    throw ApiError.validationError("The event conflicts with database reference or data constraints.");
  throw error;
}

export async function create(user: AuthenticatedUser, event: SubmissionEvent): Promise<SubmissionRecord> {
  try {
    const validEvent = parseSubmissionEvent(event) as SubmissionEvent;
    return await transaction(async client => {
      await lockEvent(client, validEvent.event_id);
      await assertUniqueEvent(client, validEvent.event_id);
      await validateReferences(client, validEvent);
      const userId = await ensureDatabaseUser(client, user);
      const result = await client.query<{ submission_id: number }>(
        `INSERT INTO submissions (submitter_user_id, session_id, status, event_data)
         VALUES ($1, $2, 'PENDING', $3::jsonb) RETURNING submission_id`,
        [userId, validEvent.session_id, JSON.stringify(validEvent)]
      );
      return readRecord(client, result.rows[0]!.submission_id);
    });
  } catch (error) { return databaseError(error); }
}

async function publishEvent(client: PoolClient, id: number, event: SubmissionEvent): Promise<void> {
  await client.query(
    `INSERT INTO accepted_events (event_id, submission_id, session_id, event_data)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [event.event_id, id, event.session_id, JSON.stringify(event)]
  );
  const { session_id: session, driver_id: driver, lap_number: lap, payload } = event;
  switch (event.type) {
    case "LAP_COMPLETED":
      await client.query(
        `INSERT INTO laps (session_id, driver_id, lap_number, lap_time_ms,
          position, is_pit_lap, is_valid, submission_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [session, driver, lap, payload.lap_time_ms, payload.position,
          payload.is_pit_lap, payload.is_valid, id]
      );
      break;
    case "PIT_STOP":
      await client.query(
        `INSERT INTO pit_stops (session_id, driver_id, lap_number, duration_ms, submission_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [session, driver, lap, payload.duration_ms, id]
      );
      break;
    case "POSITION_CHANGE":
      await client.query(
        `INSERT INTO position_changes (session_id, driver_id, overtaken_driver_id,
          lap_number, position_before, position_after, submission_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [session, driver, payload.overtaken_driver_id, lap,
          payload.position_before, payload.position_after, id]
      );
      break;
    case "PENALTY_ISSUED":
      await client.query(
        `INSERT INTO penalties (session_id, driver_id, lap_number, penalty_type,
          duration_ms, reason, submission_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [session, driver, lap ?? null, payload.penalty_type,
          payload.duration_ms, payload.reason, id]
      );
      break;
    case "RETIREMENT":
      await client.query(
        `INSERT INTO retirements (session_id, driver_id, lap_number, reason, submission_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [session, driver, lap ?? null, payload.reason, id]
      );
      break;
    case "SESSION_START":
    case "SESSION_END":
    case "FASTEST_LAP_SET":
      // Session boundaries and fastest-lap markers remain in the full event
      // envelope. A fastest-lap marker is not a second completed lap.
      break;
  }
}

export async function review(
  submissionId: number, admin: AuthenticatedUser, status: SubmissionStatus,
  validationMessageText: string | null
): Promise<SubmissionRecord | null> {
  if (admin.role !== "ADMIN") throw ApiError.forbidden("Administrator access required.");
  if (status !== "ACCEPTED" && status !== "REJECTED")
    throw ApiError.validationError("Invalid review status.");
  if (status === "REJECTED" && (!validationMessageText?.trim() || validationMessageText.length > 2000))
    throw ApiError.validationError("A rejection reason of at most 2000 characters is required.");
  if (status === "ACCEPTED" && validationMessageText)
    throw ApiError.validationError("Accepted submissions cannot have a rejection reason.");
  try {
    return await transaction(async client => {
      const result = await client.query<{
        status: SubmissionStatus; event_data: unknown; submitter_user_id: number;
      }>(
        `SELECT status, event_data, submitter_user_id FROM submissions
         WHERE submission_id = $1 FOR UPDATE`, [submissionId]
      );
      const row = result.rows[0];
      if (!row) return null;
      if (row.status !== "PENDING")
        throw ApiError.conflict("SUBMISSION_ALREADY_REVIEWED", "This submission has already been reviewed.");

      let event: SubmissionEvent | null = null;
      if (status === "ACCEPTED") {
        try {
          event = parseSubmissionEvent(row.event_data) as SubmissionEvent;
        } catch (error) {
          if (error instanceof z.ZodError)
            throw ApiError.validationError(`The stored event is invalid: ${validationMessage(error)}`);
          throw error;
        }
        await lockEvent(client, event.event_id);
        // Ignore the current pending submission, but reject other pending or
        // accepted records, including legacy duplicates.
        const duplicates = await client.query(
          `SELECT 1 FROM accepted_events WHERE event_id = $1
           UNION ALL SELECT 1 FROM submissions
           WHERE event_data->>'event_id' = $1
             AND submission_id <> $2 AND status IN ('PENDING','ACCEPTED')
           LIMIT 1`, [event.event_id, submissionId]
        );
        if (duplicates.rowCount)
          throw ApiError.conflict("DUPLICATE_EVENT", "This event ID is already pending or accepted.");
        await validateReferences(client, event);
      }

      const adminId = await ensureDatabaseUser(client, admin);
      if (status === "ACCEPTED") await publishEvent(client, submissionId, event!);
      await client.query(
        `UPDATE submissions SET status = $2, validation_message = $3,
           reviewed_at = NOW(), reviewed_by = $4 WHERE submission_id = $1`,
        [submissionId, status, validationMessageText, adminId]
      );
      return readRecord(client, submissionId);
    });
  } catch (error) { return databaseError(error); }
}
