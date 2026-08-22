import type {
  NextFunction,
  Response,
} from "express";

import type {
  AuthenticatedRequest,
} from "./authenticate.js";

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const user = req.authenticatedUser;

  if (!user) {
    res.status(401).json({
      error: "Authentication required.",
    });
    return;
  }

  if (user.role !== "ADMIN") {
    res.status(403).json({
      error: "Administrator access required.",
    });
    return;
  }

  next();
}

export function requireSubmitterOrAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const user = req.authenticatedUser;

  if (!user) {
    res.status(401).json({
      error: "Authentication required.",
    });
    return;
  }

  const isAdmin = user.role === "ADMIN";

  const isApprovedSubmitter =
    user.role === "SUBMITTER" &&
    user.submitterStatus === "APPROVED";

  if (!isAdmin && !isApprovedSubmitter) {
    res.status(403).json({
      error:
        "Approved submitter or administrator access required.",
    });
    return;
  }

  next();
}