import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import request from "supertest";
import { createApp } from "../app.js";
import { ApiError } from "./ApiError.js";
import { errorHandler } from "./errorHandler.js";

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("errorHandler", () => {
  it("converts an ApiError into the documented error envelope", () => {
    const res = mockResponse();
    const err = ApiError.notFound("Driver 'XXX' was not found.");

    errorHandler(err, {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "NOT_FOUND", message: "Driver 'XXX' was not found." },
    });
  });

  it("hides unhandled error details behind a generic 500", () => {
    const res = mockResponse();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(new Error("leaked db connection string"), {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
    });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("answers an express.json parse failure with a 400 VALIDATION_ERROR", () => {
    const res = mockResponse();
    const parseError = Object.assign(new SyntaxError("Unexpected token"), {
      type: "entity.parse.failed",
      status: 400,
    });

    errorHandler(parseError, {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body is not valid JSON.",
      },
    });
  });
});

describe("errorHandler wired into the app", () => {
  const app = createApp();

  it("rejects a malformed JSON body with 400 before any route runs", async () => {
    // /submissions requires auth, so a 400 here proves the body parser
    // rejected the request before authenticate could answer 401.
    const response = await request(app)
      .post("/api/v1/submissions")
      .set("Content-Type", "application/json")
      .send('{"event": ');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body is not valid JSON.",
      },
    });
  });

  it("rejects a disallowed origin with 403 FORBIDDEN", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "https://evil.example");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "CORS blocked request from origin: https://evil.example",
      },
    });
  });
});
