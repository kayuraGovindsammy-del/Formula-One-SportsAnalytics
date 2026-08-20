import "dotenv/config";
import cors from "cors";
import express from "express";
import apiV1Router from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

app.use("/api/v1", apiV1Router);

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

export default app;
