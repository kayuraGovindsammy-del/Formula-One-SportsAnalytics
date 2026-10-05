import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

const app = createApp();

describe("GET /api/v1/health", () => {
  it("returns 200 with the standard success envelope", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({
      data: { status: "ok" },
      meta: {},
    });
  });

  it("is public: no Authorization header is required", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).not.toBe(401);
  });

  it("is only mounted under /api/v1", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
