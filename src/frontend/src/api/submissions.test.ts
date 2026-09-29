import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { User } from "firebase/auth";

import { API_BASE_URL, submissionRequest } from "./submissions";
import { buildExportUrl } from "./exports";

const user = {
  getIdToken: vi.fn().mockResolvedValue("token-123"),
} as unknown as User;

describe("submission API helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  test("adds bearer authentication and returns response data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 7 } }),
    }));

    const result = await submissionRequest<{ id: number }>(user, "/submissions/mine");

    expect(result).toEqual({ id: 7 });
    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/submissions/mine`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
    }));
  });

  test("adds JSON content type when a request has a body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { ok: true } }),
    }));

    await submissionRequest(user, "/submissions", {
      method: "POST",
      body: JSON.stringify({ test: true }),
      headers: { "X-Test": "yes" },
    });

    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/submissions`, expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer token-123",
        "Content-Type": "application/json",
        "X-Test": "yes",
      }),
    }));
  });

  test("uses string API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad submission" }),
    }));

    await expect(submissionRequest(user, "/bad")).rejects.toThrow("Bad submission");
  });

  test("uses nested or fallback API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "Forbidden" } }),
    }).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error("not json"); },
    }));

    await expect(submissionRequest(user, "/forbidden")).rejects.toThrow("Forbidden");
    await expect(submissionRequest(user, "/broken")).rejects.toThrow("Request failed (500).");
  });

  test("buildExportUrl creates encoded export links", () => {
    expect(buildExportUrl("results", "csv", "2025")).toBe(
      `${API_BASE_URL}/export/results?format=csv&season=2025`
    );
    expect(buildExportUrl("drivers", "json", "2024 season")).toContain("season=2024+season");
  });
});
