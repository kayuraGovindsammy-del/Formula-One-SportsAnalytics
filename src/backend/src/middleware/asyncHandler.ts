import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Express 5 forwards rejected promises to the error handler on its own, but
 * this wrapper is kept explicit rather than relying on that — it's the same
 * shape controllers would need if the app ever moved back to Express 4.
 */
export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
