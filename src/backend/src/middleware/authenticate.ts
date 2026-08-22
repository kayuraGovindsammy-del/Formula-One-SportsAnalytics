import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  adminAuth,
  adminDb,
} from "../config/firebaseAdmin.js";

import type {
  AuthenticatedUser,
  SubmitterStatus,
  UserRole,
} from "../types/auth.types.js";

export interface AuthenticatedRequest extends Request {
  authenticatedUser?: AuthenticatedUser;
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

    const decodedToken =
      await adminAuth.verifyIdToken(token);

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
    console.error("Authentication failed:", error);

    res.status(401).json({
      error: "Invalid or expired Firebase token.",
    });
  }
}