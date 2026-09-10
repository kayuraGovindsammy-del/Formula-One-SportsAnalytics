import { deletionRequested } from "../services/accountDeletion.js";

import type { DecodedIdToken } from "firebase-admin/auth";

import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  getAdminAuth,
  getAdminDb,
} from "../config/firebaseAdmin.js";

import type {
  AuthenticatedUser,
  SubmitterStatus,
  UserRole,
} from "../types/auth.types.js";

export interface AuthenticatedRequest extends Request {
  authenticatedUser?: AuthenticatedUser;
  authTime?: number;
}

function normalizeRole(value: unknown): UserRole {
  if (value === "ADMIN") {
    return "ADMIN";
  }

  if (value === "SUBMITTER") {
    return "SUBMITTER";
  }

  return "USER";
}

function normalizeSubmitterStatus(
  value: unknown
): SubmitterStatus {
  switch (value) {
    case "pending":
    case "PENDING":
      return "PENDING";

    case "approved":
    case "APPROVED":
      return "APPROVED";

    case "rejected":
    case "REJECTED":
      return "REJECTED";

    default:
      return "NONE";
  }
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorization = req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      res.status(401).json({
        error: "Firebase ID token required.",
      });
      return;
    }

    const token = authorization.slice("Bearer ".length);
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    let decodedToken: DecodedIdToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token, true);
    } catch {
      res.status(401).json({ error: "Invalid or expired Firebase token." });
      return;
    }
    req.authTime = decodedToken.auth_time;

    if (await deletionRequested(decodedToken.uid)) {
      res.status(403).json({ error: "Account deletion has been requested." });
      return;
    }

    const marker = await adminDb.collection("accountDeletions").doc(decodedToken.uid).get();
    if (marker.exists) {
      res.status(403).json({ error: "Account deletion has been requested." });
      return;
    }

    const userSnapshot =
      await adminDb
        .collection("users")
        .doc(decodedToken.uid)
        .get();

    if (!userSnapshot.exists) {
      res.status(401).json({
        error: "No Firestore user profile exists.",
      });
      return;
    }

    const data = userSnapshot.data();
    if (data?.deletionPending === true) {
      res.status(403).json({ error: "Account deletion is in progress." });
      return;
    }

    req.authenticatedUser = {
      uid: decodedToken.uid,

      email:
        decodedToken.email ??
        (typeof data?.email === "string"
          ? data.email
          : null),

      displayName:
        typeof data?.name === "string"
          ? data.name
          : null,

      role: normalizeRole(data?.role),

      submitterStatus:
        normalizeSubmitterStatus(
          data?.submitterStatus
        ),
    };

    next();
  } catch (error) {
    console.error("Authentication service unavailable.");
    next(error);
  }
}