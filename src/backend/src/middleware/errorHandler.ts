import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./ApiError.js";

/**
 * express.json() rejects an unparseable body with an error carrying
 * `type: "entity.parse.failed"`. That is the client's fault, not ours, so it
 * must surface as a 400 rather than falling through to the generic 500.
 */
function isMalformedJsonBody(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    err.type === "entity.parse.failed"
  );
}

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

  if (isMalformedJsonBody(err)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body is not valid JSON.",
      },
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
