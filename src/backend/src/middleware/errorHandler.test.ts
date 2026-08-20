import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
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
});
