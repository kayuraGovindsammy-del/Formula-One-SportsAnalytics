import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import { getHealth } from "./health.controller.js";

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("getHealth", () => {
  it("returns the standard success envelope with status ok", () => {
    const res = mockResponse();

    getHealth({} as never, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: { status: "ok" },
      meta: {},
    });
  });
});
