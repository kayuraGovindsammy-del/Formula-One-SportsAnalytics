import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import {
  SPEC_FILENAME,
  loadOpenApiSpec,
  specCandidatePaths,
} from "../config/openapiSpec.js";

const app = createApp();

describe("GET /api/docs", () => {
  it("serves the Swagger UI page with 200", async () => {
    const response = await request(app).get("/api/docs");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
    expect(response.text).toContain("swagger-ui");
  });

  it("serves the same page with a trailing slash, without redirecting", async () => {
    // swagger-ui-express's default wiring 301s /api/docs -> /api/docs/.
    // docs.routes.ts absolutises the asset URLs so both spellings are 200.
    const response = await request(app).get("/api/docs/");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
  });

  it("references its assets absolutely so the page works without a trailing slash", async () => {
    const response = await request(app).get("/api/docs");

    expect(response.text).toContain('src="/api/docs/swagger-ui-bundle.js"');
    // A leftover relative reference would 404 when loaded from /api/docs.
    expect(response.text).not.toMatch(/(href|src)="\.\//);
  });

  it("serves its own assets rather than a CDN", async () => {
    const css = await request(app).get("/api/docs/swagger-ui.css");

    expect(css.status).toBe(200);
    expect(css.headers["content-type"]).toMatch(/text\/css/);

    const initScript = await request(app).get("/api/docs/swagger-ui-init.js");

    expect(initScript.status).toBe(200);
    // The init script is what hands the spec to the browser.
    expect(initScript.text).toContain("F1 Sport Analytics API");
  });

  it("titles the page for this project", async () => {
    const response = await request(app).get("/api/docs");

    expect(response.text).toContain("<title>F1 Sport Analytics API</title>");
  });
});

describe("GET /api/openapi.json", () => {
  it("serves a valid OpenAPI 3.1 document", async () => {
    const response = await request(app).get("/api/openapi.json");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);

    const document: Record<string, unknown> = response.body;

    expect(document["openapi"]).toMatch(/^3\.1\./);
    expect(document["info"]).toMatchObject({ title: "F1 Sport Analytics API" });
    expect(document["paths"]).toBeTypeOf("object");
    expect(document["components"]).toBeTypeOf("object");
  });

  it("describes exactly the routes the app mounts", async () => {
    const response = await request(app).get("/api/openapi.json");
    const paths: unknown = response.body.paths;

    expect(paths).toBeTypeOf("object");
    expect(Object.keys(paths as Record<string, unknown>).sort()).toEqual([
      "/constructors/{constructor_id}/stats",
      "/drivers",
      "/drivers/{driver_id}",
      "/drivers/{driver_id}/stats",
      "/export/{dataset}",
      "/health",
      "/races",
      "/races/{grand_prix_id}",
      "/races/{grand_prix_id}/events",
      "/races/{grand_prix_id}/laps",
      "/races/{grand_prix_id}/qualifying",
      "/races/{grand_prix_id}/statistics",
      "/submissions",
      "/submissions/mine",
      "/submissions/{submission_id}",
      "/users/me",
    ]);
  });

  it("declares the deployed API as a server so Try it out can reach it", async () => {
    const response = await request(app).get("/api/openapi.json");
    const servers: unknown = response.body.servers;

    expect(Array.isArray(servers)).toBe(true);

    const urls = (servers as { url?: unknown }[]).map((server) => server.url);

    // Relative first: same-origin, so it needs no CORS wherever it is served.
    expect(urls[0]).toBe("/api/v1");
    expect(urls).toContain(
      "https://f1-sport-analytics-api-production.up.railway.app/api/v1"
    );
  });
});

describe("GET /api/openapi.yaml", () => {
  it("serves the spec verbatim as YAML", async () => {
    const response = await request(app).get("/api/openapi.yaml");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/yaml/);
    expect(response.text.startsWith("openapi: 3.1.0")).toBe(true);
  });

  it("serves byte-for-byte what is on disk", async () => {
    const spec = loadOpenApiSpec();

    expect(spec).not.toBeNull();

    const response = await request(app).get("/api/openapi.yaml");

    expect(response.text).toBe(spec?.yaml);
  });
});

describe("spec resolution", () => {
  it("finds the spec in this checkout", () => {
    const spec = loadOpenApiSpec();

    expect(spec).not.toBeNull();
    expect(spec?.path).toContain(SPEC_FILENAME);
  });

  it("looks in the build output before walking up to the repo root", () => {
    // Guards the deploy path: `npm run build` copies the spec to dist/, and
    // that copy must win over a repo checkout that may not be deployed.
    const candidates = specCandidatePaths("/srv/app/dist/config");

    expect(candidates[0]).toBe(`/srv/app/dist/${SPEC_FILENAME}`);
    expect(candidates).toContain(`/srv/app/dist/docs/api/${SPEC_FILENAME}`);
    expect(candidates).toContain(`/srv/docs/api/${SPEC_FILENAME}`);
  });

  it("terminates at the filesystem root", () => {
    const candidates = specCandidatePaths("/");

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates).toContain(`/docs/api/${SPEC_FILENAME}`);
  });
});

describe("CORS from the docs page", () => {
  // Browsers omit Origin on same-origin GETs but attach it to same-origin
  // POST/PATCH/DELETE. Without same-origin acceptance, Swagger UI's
  // "Try it out" on a write endpoint is rejected by the server talking to
  // itself — and the rejection surfaces as a 403 FORBIDDEN.
  it("accepts a write request from its own docs page", async () => {
    const response = await request(app)
      .post("/api/v1/submissions")
      .set("Host", "localhost:3001")
      .set("Origin", "http://localhost:3001")
      .send({});

    // 401 means the request reached the auth middleware: CORS let it through.
    expect(response.status).toBe(401);
  });

  it("accepts a same-origin request behind a TLS-terminating proxy", async () => {
    // Railway terminates TLS, so req.protocol is http while the browser
    // reports an https Origin. Matching on host keeps this working.
    const response = await request(app)
      .post("/api/v1/submissions")
      .set("Host", "f1-sport-analytics-api-production.up.railway.app")
      .set("Origin", "https://f1-sport-analytics-api-production.up.railway.app")
      .send({});

    expect(response.status).toBe(401);
  });

  it("still accepts the configured frontend origin", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
  });

  it("still accepts a request with no Origin at all", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
  });

  it("still rejects a genuinely cross-origin request", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Host", "localhost:3001")
      .set("Origin", "https://evil.example");

    expect(response.status).toBe(403);
  });

  it("treats a malformed Origin as not same-origin", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Host", "localhost:3001")
      .set("Origin", "not a url");

    expect(response.status).toBe(403);
  });
});

describe("docs routes and the API envelope", () => {
  it("leaves the 404 envelope intact for an unknown /api path", async () => {
    const response = await request(app).get("/api/not-a-real-docs-path");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "No route matches GET /api/not-a-real-docs-path",
      },
    });
  });

  it("does not shadow the versioned API", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: "ok" }, meta: {} });
  });
});
