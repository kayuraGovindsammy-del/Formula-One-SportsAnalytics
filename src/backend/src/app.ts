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

  app.use(cors({ origin: process.env.CORS_ORIGIN }));
  app.use(express.json());

  app.use("/api/v1", apiV1Router);

  // Registered last: unmatched routes first, then the error handler.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
