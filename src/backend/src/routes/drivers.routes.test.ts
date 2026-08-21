import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

const app = createApp();

describe("GET /api/v1/drivers", () => {
  it("returns the full 2025 roster in the documented envelope", async () => {
    const res = await request(app).get("/api/v1/drivers");

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({
      page: 1,
      per_page: 20,
      total_items: 20,
      total_pages: 1,
    });
    expect(res.body.data).toHaveLength(20);
    expect(res.body.error).toBeUndefined();
  });

  it("resolves constructor_name server-side", async () => {
    const res = await request(app).get("/api/v1/drivers");

    expect(res.body.data[0]).toEqual({
      driver_id: "VER",
      permanent_number: 1,
      given_name: "Max",
      family_name: "Verstappen",
      nationality: "Dutch",
      date_of_birth: "1997-09-30",
      constructor_id: "RBR",
      constructor_name: "Red Bull Racing",
    });
  });

  it("filters by constructor_id", async () => {
    const res = await request(app).get("/api/v1/drivers?constructor_id=MCL");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total_items).toBe(2);
    for (const driver of res.body.data) {
      expect(driver.constructor_id).toBe("MCL");
      expect(driver.constructor_name).toBe("McLaren");
    }
  });

  it("filters by nationality", async () => {
    const res = await request(app).get("/api/v1/drivers?nationality=Dutch");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].driver_id).toBe("VER");
  });

  it("searches across given and family name, case-insensitively", async () => {
    const res = await request(app).get("/api/v1/drivers?search=verstappen");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].driver_id).toBe("VER");
  });

  it("treats an empty filter value as no filter rather than an error", async () => {
    const res = await request(app).get("/api/v1/drivers?search=");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20);
  });

  it("ignores unknown query params", async () => {
    const res = await request(app).get("/api/v1/drivers?not_a_real_param=42");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20);
  });
});

describe("GET /api/v1/drivers — pagination", () => {
  it("honours page and per_page", async () => {
    const res = await request(app).get("/api/v1/drivers?page=2&per_page=5");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.meta).toEqual({
      page: 2,
      per_page: 5,
      total_items: 20,
      total_pages: 4,
    });
  });

  it("returns 200 with an empty array beyond the last page", async () => {
    const res = await request(app).get("/api/v1/drivers?page=99&per_page=5");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total_items).toBe(20);
    expect(res.body.meta.total_pages).toBe(4);
  });

  it("clamps per_page above the maximum instead of rejecting it", async () => {
    const res = await request(app).get("/api/v1/drivers?per_page=1000");

    expect(res.status).toBe(200);
    expect(res.body.meta.per_page).toBe(100);
    expect(res.body.data).toHaveLength(20);
  });

  it("rejects a non-numeric page with VALIDATION_ERROR", async () => {
    const res = await request(app).get("/api/v1/drivers?page=abc");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.data).toBeUndefined();
  });

  it("rejects page below 1 with VALIDATION_ERROR", async () => {
    const res = await request(app).get("/api/v1/drivers?page=0");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/v1/drivers/:driver_id", () => {
  it("returns a single driver with an empty meta object", async () => {
    const res = await request(app).get("/api/v1/drivers/PIA");

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({});
    expect(res.body.data).toEqual({
      driver_id: "PIA",
      permanent_number: 81,
      given_name: "Oscar",
      family_name: "Piastri",
      nationality: "Australian",
      date_of_birth: "2001-04-06",
      constructor_id: "MCL",
      constructor_name: "McLaren",
    });
  });

  it("resolves a lowercase driver id", async () => {
    const res = await request(app).get("/api/v1/drivers/ver");

    expect(res.status).toBe(200);
    expect(res.body.data.driver_id).toBe("VER");
  });

  it("returns NOT_FOUND naming the missing driver", async () => {
    const res = await request(app).get("/api/v1/drivers/ZZZ");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("ZZZ");
  });
});
