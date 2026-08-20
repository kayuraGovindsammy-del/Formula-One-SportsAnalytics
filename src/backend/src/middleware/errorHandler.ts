import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./ApiError.js";

/**
 * Must be registered after every route and after notFoundHandler — Express
 * recognizes an error middleware by its four-argument signature.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.httpStatus).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  console.error(err);

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong.",
    },
  });
}
