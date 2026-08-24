import cors from "cors";
import express, { type Express } from "express";

import apiV1Router from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";

/**
 * Builds the Express app without binding a port, so tests can exercise routes
 * over supertest without starting a listener. index.ts is the only place that
 * calls listen().
 */
export function createApp(): Express {
  const app = express();

  const allowedOrigins = (
    process.env.CORS_ORIGINS ??
    "http://localhost:5173"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests without an Origin header,
        // such as Postman, curl, or server-to-server requests.
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(
          new Error(
            `CORS blocked request from origin: ${origin}`
          )
        );
      },
    })
  );

  app.use(express.json());

  app.use("/api/v1", apiV1Router);

  // Registered last: unmatched routes first, then the error handler.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}