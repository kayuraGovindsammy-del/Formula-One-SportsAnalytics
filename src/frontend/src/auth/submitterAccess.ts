import { type User } from "firebase/auth";
import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type ReviewDecision = "approved" | "rejected";

/**
 * Firestore is authoritative for application roles. These transactions are
 * also checked by security rules; a modified frontend cannot grant itself
 * privileges. Initial ADMIN accounts are provisioned using Firebase Admin.
 */
export async function requestSubmitterAccess(user: User): Promise<void> {
  const userRef = doc(db, "users", user.uid);

  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists()) throw new Error("Your account profile was not found.");

    const data = snapshot.data();
    if (data.deletionPending === true) throw new Error("Account deletion is in progress.");
    if (data.role !== "USER" ||
        (data.submitterStatus !== "none" && data.submitterStatus !== "rejected")) {
      throw new Error("Your account is not eligible to request submitter access.");
    }

    transaction.update(userRef, {
      submitterStatus: "pending",
      requestedAt: serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      reviewReason: null,
    });
  });
}

export async function reviewSubmitterRequest(
  admin: User,
  targetUid: string,
  decision: ReviewDecision,
  reason = "",
): Promise<void> {
  if (admin.uid === targetUid) throw new Error("You cannot review your own account.");
  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("Invalid review decision.");
  }

  const cleanedReason = reason.trim();
  if (decision === "rejected" && !cleanedReason) {
    throw new Error("A rejection reason is required.");
  }
  if (cleanedReason.length > 1000) throw new Error("Reason must be at most 1000 characters.");

  const adminRef = doc(db, "users", admin.uid);
  const targetRef = doc(db, "users", targetUid);

  await runTransaction(db, async transaction => {
    // All reads happen before writes so competing reviews are retried safely.
    const adminSnapshot = await transaction.get(adminRef);
    const targetSnapshot = await transaction.get(targetRef);
    if (!adminSnapshot.exists() || adminSnapshot.data().role !== "ADMIN" ||
        adminSnapshot.data().deletionPending === true) {
      throw new Error("Administrator access is required.");
    }
    if (!targetSnapshot.exists()) throw new Error("The request no longer exists.");

    const target = targetSnapshot.data();
    if (target.deletionPending === true || target.role !== "USER" ||
        target.submitterStatus !== "pending") {
      throw new Error("This request is no longer pending. Refresh the list.");
    }

    transaction.update(targetRef, {
      role: decision === "approved" ? "SUBMITTER" : "USER",
      submitterStatus: decision,
      reviewedAt: serverTimestamp(),
      reviewedBy: admin.uid,
      reviewReason: decision === "rejected" ? cleanedReason : "",
    });
  });
}
