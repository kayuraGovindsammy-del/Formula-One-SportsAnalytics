import { getPool } from "../config/database.js";
import { getAdminAuth, getAdminDb } from "../config/firebaseAdmin.js";
import { ApiError } from "../middleware/ApiError.js";

/**
 * Tombstones are retained so a deleted UID cannot recreate its profile.
 * The Firebase UID is an internal pseudonymous identifier, not a password.
 * This service never accepts an arbitrary UID from a public request.
 */
export async function deletionRequested(uid: string): Promise<boolean> {
  const result = await getPool().query(
    "SELECT 1 FROM account_deletions WHERE auth_uid = $1",
    [uid]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function requestAccountDeletion(uid: string): Promise<boolean> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Coordinate with user creation/upserts in submissions.model.ts.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [uid]);
    await client.query(
      "INSERT INTO account_deletions (auth_uid) VALUES ($1) ON CONFLICT DO NOTHING",
      [uid]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return completeAccountDeletion(uid);
}

/**
 * A row lock serializes concurrent workers and requests. Each step is
 * idempotent, so a process crash can be retried without restoring privileges.
 * Firebase and PostgreSQL cannot participate in one distributed transaction.
 */
export async function completeAccountDeletion(uid: string): Promise<boolean> {
  const client = await getPool().connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;
    const result = await client.query<{ completed_at: Date | null }>(
      "SELECT completed_at FROM account_deletions WHERE auth_uid = $1 FOR UPDATE",
      [uid]
    );

    if (!result.rows[0]) {
      throw ApiError.notFound("Account deletion request was not found.");
    }
    if (result.rows[0].completed_at) {
      await client.query("COMMIT");
      inTransaction = false;
      return true;
    }

    await client.query(
      `UPDATE account_deletions
       SET attempts = attempts + 1, last_attempt_at = NOW()
       WHERE auth_uid = $1`,
      [uid]
    );

    const adminDb = getAdminDb();
    const profile = adminDb.collection("users").doc(uid);
    const marker = adminDb.collection("accountDeletions").doc(uid);

    // A permanent server-owned marker prevents recreation using an ID token
    // that remains valid briefly after the Firebase Auth user is deleted.
    await marker.set({ deleted: true }, { merge: true });

    // Mark the profile first, so no client can restore access during cleanup.
    await profile.set({
      deletionPending: true,
      role: "USER",
      submitterStatus: "none",
    }, { merge: true });

    try {
      await getAdminAuth().deleteUser(uid);
    } catch (error) {
      if (!(typeof error === "object" && error !== null &&
        "code" in error && error.code === "auth/user-not-found")) {
        throw error;
      }
    }

    await profile.delete();

    // Preserve stable database IDs and submission foreign keys, but remove
    // contact details and privileged roles. The original UID stays only
    // in the restricted deletion tombstone.
    await client.query(
      `UPDATE users
       SET auth_uid = 'deleted-user-' || user_id::text,
           email = 'deleted-' || user_id::text || '@deleted.invalid',
           display_name = 'Deleted account',
           role = 'USER',
           submitter_status = 'NONE',
           updated_at = NOW()
       WHERE auth_uid = $1`,
      [uid]
    );

    await client.query(
      "UPDATE account_deletions SET completed_at = NOW() WHERE auth_uid = $1",
      [uid]
    );
    await client.query("COMMIT");
    inTransaction = false;
    return true;
  } catch (error) {
    if (inTransaction) await client.query("ROLLBACK");
    if (error instanceof ApiError) throw error;
    // Do not log credentials, identity data, or provider error details.
    console.error("Account cleanup pending; retry is required.");
    return false;
  } finally {
    client.release();
  }
}

export async function retryPendingDeletions(): Promise<void> {
  const result = await getPool().query<{ auth_uid: string }>(
    `SELECT auth_uid FROM account_deletions
     WHERE completed_at IS NULL
     ORDER BY requested_at LIMIT 50`
  );
  for (const row of result.rows) {
    await completeAccountDeletion(row.auth_uid);
  }
}
