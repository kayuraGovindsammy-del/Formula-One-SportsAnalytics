import type { Request, Response } from "express";

/**
 * Registered after every real route, before errorHandler — catches anything
 * that didn't match a route.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `No route matches ${req.method} ${req.originalUrl}`,
    },
  });
}
