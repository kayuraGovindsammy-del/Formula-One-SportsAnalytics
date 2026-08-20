import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

const app = createApp();

describe("GET /api/v1/races", () => {
  it("returns the 2025 calendar paginated by default", async () => {
    const res = await request(app).get("/api/v1/races");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.meta).toEqual({
      page: 1,
      per_page: 20,
      total_items: 24,
      total_pages: 2,
    });
  });

  it("derives grand_prix_id and flags which races have event data", async () => {
    const res = await request(app).get("/api/v1/races?search=belgian");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual({
      grand_prix_id: "2025_R13",
      season_id: "2025",
      round: 13,
      race_name: "Belgian Grand Prix",
      circuit_id: "spa",
      circuit_name: "Circuit de Spa-Francorchamps",
      locality: "Spa",
      country: "Belgium",
      date: "2025-07-27",
      has_sprint: true,
      has_results: true,
    });
  });

  it("reports has_results false for races with no event log", async () => {
    const res = await request(app).get("/api/v1/races?search=australian");

    expect(res.status).toBe(200);
    expect(res.body.data[0].grand_prix_id).toBe("2025_R1");
    expect(res.body.data[0].has_results).toBe(false);
  });

  it("filters by has_sprint", async () => {
    const res = await request(app).get("/api/v1/races?has_sprint=true&per_page=100");

    expect(res.status).toBe(200);
    expect(res.body.meta.total_items).toBe(6);
    for (const race of res.body.data) {
      expect(race.has_sprint).toBe(true);
    }
  });

  it("filters by season, returning an empty page for an unknown one", async () => {
    const known = await request(app).get("/api/v1/races?season=2025");
    expect(known.body.meta.total_items).toBe(24);

    const unknown = await request(app).get("/api/v1/races?season=1999");
    expect(unknown.status).toBe(200);
    expect(unknown.body.data).toEqual([]);
    expect(unknown.body.meta.total_items).toBe(0);
  });

  it("rejects a non-boolean has_sprint with VALIDATION_ERROR", async () => {
    const res = await request(app).get("/api/v1/races?has_sprint=maybe");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns the second page", async () => {
    const res = await request(app).get("/api/v1/races?page=2");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
    expect(res.body.meta.page).toBe(2);
  });
});

describe("GET /api/v1/races/:grand_prix_id", () => {
  it("returns the race with its sessions and an empty meta object", async () => {
    const res = await request(app).get("/api/v1/races/2025_R13");

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({});
    expect(res.body.data.grand_prix_id).toBe("2025_R13");
    expect(res.body.data.race_name).toBe("Belgian Grand Prix");
    expect(res.body.data.sessions).toEqual([
      {
        session_id: "2025_R13_RACE",
        grand_prix_id: "2025_R13",
        type: "RACE",
        total_laps: 44,
        start_time: "2025-07-27T13:00:00Z",
        end_time: "2025-07-27T14:30:00Z",
      },
    ]);
  });

  it("returns an empty sessions array for a race with no event data", async () => {
    const res = await request(app).get("/api/v1/races/2025_R1");

    expect(res.status).toBe(200);
    expect(res.body.data.sessions).toEqual([]);
  });

  it("returns NOT_FOUND naming the missing race", async () => {
    const res = await request(app).get("/api/v1/races/2025_R99");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("2025_R99");
  });
});

describe("GET /api/v1/races/:grand_prix_id/laps", () => {
  it("returns the session's laps with a log-sized default page", async () => {
    const res = await request(app).get("/api/v1/races/2025_R13/laps");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(13);
    expect(res.body.meta).toEqual({
      page: 1,
      per_page: 100,
      total_items: 13,
      total_pages: 1,
    });
  });

  it("returns lap rows in the documented shape without sample-data annotations", async () => {
    const res = await request(app).get(
      "/api/v1/races/2025_R13/laps?driver_id=PIA"
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
    expect(Object.keys(res.body.data[0]).sort()).toEqual([
      "driver_id",
      "is_pit_lap",
      "is_valid",
      "lap_number",
      "lap_time_ms",
      "position",
      "session_id",
    ]);
    expect(res.body.data[0].session_id).toBe("2025_R13_RACE");
    expect(res.body.data[0].driver_id).toBe("PIA");
  });

  it("paginates laps", async () => {
    const res = await request(app).get(
      "/api/v1/races/2025_R13/laps?page=2&per_page=5"
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.meta.total_pages).toBe(3);

    const beyond = await request(app).get(
      "/api/v1/races/2025_R13/laps?page=9&per_page=5"
    );
    expect(beyond.status).toBe(200);
    expect(beyond.body.data).toEqual([]);
  });

  it("returns an empty page for a session type with no data", async () => {
    const res = await request(app).get(
      "/api/v1/races/2025_R13/laps?session_type=QUALIFYING"
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total_items).toBe(0);
  });

  it("rejects an unknown session_type with VALIDATION_ERROR", async () => {
    const res = await request(app).get(
      "/api/v1/races/2025_R13/laps?session_type=BRUNCH"
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns NOT_FOUND for an unknown race", async () => {
    const res = await request(app).get("/api/v1/races/2025_R99/laps");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/v1/races/:grand_prix_id/events", () => {
  it("returns the session's event log", async () => {
    const res = await request(app).get("/api/v1/races/2025_R13/events");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.meta).toEqual({
      page: 1,
      per_page: 100,
      total_items: 10,
      total_pages: 1,
    });
  });

  it("omits driver_id and lap_number on session boundary events", async () => {
    const res = await request(app).get(
      "/api/v1/races/2025_R13/events?type=SESSION_START"
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual({
      event_id: "evt_001",
      session_id: "2025_R13_RACE",
      type: "SESSION_START",
      timestamp: "2025-07-27T13:00:00Z",
      payload: {},
    });
  });

  it("reports timestamp as null where the sample data has none", async () => {
    const res = await request(app).get(
      "/api/v1/races/2025_R13/events?type=POSITION_CHANGE"
    );

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({
      event_id: "evt_004",
      session_id: "2025_R13_RACE",
      driver_id: "PIA",
      type: "POSITION_CHANGE",
      lap_number: 5,
      timestamp: null,
      payload: {
        overtaken_driver_id: "NOR",
        position_before: 2,
        position_after: 1,
      },
    });
  });

  it("filters by event type and by driver", async () => {
    const byType = await request(app).get(
      "/api/v1/races/2025_R13/events?type=PIT_STOP"
    );
    expect(byType.body.meta.total_items).toBe(3);

    const byDriver = await request(app).get(
      "/api/v1/races/2025_R13/events?driver_id=PIA"
    );
    expect(byDriver.body.meta.total_items).toBe(3);
  });

  it("rejects an unknown event type with VALIDATION_ERROR", async () => {
    const res = await request(app).get(
      "/api/v1/races/2025_R13/events?type=SAFETY_CAR"
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns an empty page for a race with no event log", async () => {
    const res = await request(app).get("/api/v1/races/2025_R1/events");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns NOT_FOUND for an unknown race", async () => {
    const res = await request(app).get("/api/v1/races/2025_R99/events");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
