import type {
  NextFunction,
  Response,
} from "express";

import { ApiError } from "./ApiError.js";
import type {
  AuthenticatedRequest,
} from "./authenticate.js";

export function requireAdmin(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const user = req.authenticatedUser;

  if (!user) {
    next(ApiError.unauthenticated("Authentication required."));
    return;
  }

  if (user.role !== "ADMIN") {
    next(ApiError.forbidden("Administrator access required."));
    return;
  }

  next();
}

export function requireSubmitterOrAdmin(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const user = req.authenticatedUser;

  if (!user) {
    next(ApiError.unauthenticated("Authentication required."));
    return;
  }

  const isAdmin = user.role === "ADMIN";

  const isApprovedSubmitter =
    user.role === "SUBMITTER" &&
    user.submitterStatus === "APPROVED";

  if (!isAdmin && !isApprovedSubmitter) {
    next(
      ApiError.forbidden(
        "Approved submitter or administrator access required."
      )
    );
    return;
  }

  next();
}