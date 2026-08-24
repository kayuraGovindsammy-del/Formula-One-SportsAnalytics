import cors from "cors";
import express, { type Express } from "express";

import apiV1Router from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";

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
        // Requests such as Postman/curl may not send an Origin header.
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
      credentials: true,
    })
  );

  app.use(express.json());

  app.use("/api/v1", apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}