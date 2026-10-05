import { deletionRequested } from "../services/accountDeletion.js";
import { ApiError } from "./ApiError.js";

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

/**
 * Rejections are forwarded as ApiError rather than thrown, so errorHandler
 * formats them in the standard envelope without passing through the catch
 * below, which is reserved for genuine authentication-service failures.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorization = req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      next(ApiError.unauthenticated("Firebase ID token required."));
      return;
    }

    const token = authorization.slice("Bearer ".length);
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    let decodedToken: DecodedIdToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token, true);
    } catch {
      next(ApiError.unauthenticated("Invalid or expired Firebase token."));
      return;
    }
    req.authTime = decodedToken.auth_time;

    if (await deletionRequested(decodedToken.uid)) {
      next(ApiError.forbidden("Account deletion has been requested."));
      return;
    }

    const marker = await adminDb.collection("accountDeletions").doc(decodedToken.uid).get();
    if (marker.exists) {
      next(ApiError.forbidden("Account deletion has been requested."));
      return;
    }

    const userSnapshot =
      await adminDb
        .collection("users")
        .doc(decodedToken.uid)
        .get();

    if (!userSnapshot.exists) {
      next(ApiError.unauthenticated("No Firestore user profile exists."));
      return;
    }

    const data = userSnapshot.data();
    if (data?.deletionPending === true) {
      next(ApiError.forbidden("Account deletion is in progress."));
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