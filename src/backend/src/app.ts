import cors from "cors";
import express, { type Express } from "express";

import apiV1Router from "./routes/index.js";
import docsRouter from "./routes/docs.routes.js";
import { ApiError } from "./middleware/ApiError.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";

/**
 * True when the request came from a page this same server served — /api/docs
 * being the one that matters.
 *
 * A same-origin request is not something CORS is meant to police, but the
 * browser still attaches an Origin header to the non-GET ones, so Swagger UI's
 * "Try it out" on POST /submissions would otherwise be rejected by the server
 * talking to itself. Hosts are compared rather than full origins because a
 * TLS-terminating proxy (Railway) leaves req.protocol as http while the
 * browser reports Origin as https.
 *
 * This cannot widen cross-origin exposure: a browser sets Origin from the
 * calling page and Host from the target, so the two only match when the
 * request genuinely originated from this server's own origin.
 */
function isSameOrigin(origin: string, req: cors.CorsRequest): boolean {
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    // A malformed Origin header is not same-origin.
    return false;
  }
}

export function createApp(): Express {
  const app = express();

  // Railway runs exactly one reverse proxy in front of the app. Trusting one
  // hop makes req.ip the client address that proxy appends to
  // X-Forwarded-For (the per-client chat rate limit depends on it), and
  // req.protocol honour X-Forwarded-Proto. Only the last hop is trusted, so a
  // client cannot pick its own req.ip by sending an X-Forwarded-For header
  // through the proxy.
  app.set("trust proxy", 1);

  const allowedOrigins = (
    process.env.CORS_ORIGINS ??
    "http://localhost:5173"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;

      // Requests such as Postman/curl may not send an Origin header.
      if (!origin) {
        callback(null, { origin: true, credentials: true });
        return;
      }

      if (allowedOrigins.includes(origin) || isSameOrigin(origin, req)) {
        callback(null, { origin: true, credentials: true });
        return;
      }

      // An ApiError, so errorHandler answers 403 FORBIDDEN instead of
      // treating the rejection as an unexpected 500.
      callback(
        ApiError.forbidden(
          `CORS blocked request from origin: ${origin}`
        )
      );
    })
  );

  app.use(express.json());

  app.use("/api/v1", apiV1Router);

  // /api/docs and /api/openapi.{yaml,json}. Public and unauthenticated —
  // "documented and publicly available" is the point.
  app.use("/api", docsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}