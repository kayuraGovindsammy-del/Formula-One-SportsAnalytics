// ---------------------------------------------------------------------------
// Interactive API documentation.
//
//   GET /api/docs          Swagger UI, rendered from docs/api/openapi.yaml
//   GET /api/openapi.yaml  the spec verbatim
//   GET /api/openapi.json  the same spec parsed, for programmatic consumers
//
// These are hand-written Express routes that RENDER a hand-written spec. No
// endpoint is generated from the schema and no route below is derived from it
// — the "hand-written API only" rule in src/backend/CLAUDE.md is about
// generating the API, which this does not do.
//
// Mounted at /api rather than /api/v1: the spec describes v1 and declares
// `/api/v1` as its server, so versioning the documentation URL alongside it
// would make the docs move every time the API version does.
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import { loadOpenApiSpec } from "../config/openapiSpec.js";

/** Public path this router is reachable at, used to absolutise asset URLs. */
export const DOCS_PATH = "/api/docs";

const router = Router();

const spec = loadOpenApiSpec();

function specUnavailable(_req: Request, res: Response): void {
  res.status(503).json({
    error: {
      code: "SPEC_UNAVAILABLE",
      message:
        "The OpenAPI specification could not be loaded on this server. " +
        "See docs/api/openapi.yaml in the repository.",
    },
  });
}

if (spec === null) {
  // The spec is missing or unreadable. Report it per route in the project's
  // standard error envelope rather than failing to boot the whole API.
  router.get("/docs", specUnavailable);
  router.get("/openapi.yaml", specUnavailable);
  router.get("/openapi.json", specUnavailable);
} else {
  const swaggerOptions: swaggerUi.SwaggerUiOptions = {
    customSiteTitle: "F1 Sport Analytics API",
    swaggerOptions: {
      // Collapsed operations: 12 paths is more than fits on one screen open.
      docExpansion: "list",
      // Lets a reader deep-link to an operation.
      deepLinking: true,
      persistAuthorization: true,
    },
  };

  // swagger-ui-express emits relative asset URLs (`./swagger-ui.css`), which
  // only resolve when the page is served WITH a trailing slash — hence the
  // 301 from /api/docs to /api/docs/ in its default wiring. Rewriting them to
  // absolute paths under the mount point makes both spellings serve the page
  // directly with a 200, which is what a documentation link should do.
  const html = swaggerUi
    .generateHTML(spec.document, swaggerOptions)
    .replaceAll('href="./', `href="${DOCS_PATH}/`)
    .replaceAll('src="./', `src="${DOCS_PATH}/`);

  // Registered before the asset middleware so the exact path returns the page
  // rather than express.static's directory redirect.
  router.get("/docs", (_req, res) => {
    res.type("html").send(html);
  });

  // swagger-ui-bundle.js, swagger-ui.css and the generated swagger-ui-init.js
  // that carries the spec. Served from node_modules, not a CDN, so the page
  // renders without external network access.
  router.use("/docs", swaggerUi.serveFiles(spec.document, swaggerOptions));

  router.get("/openapi.yaml", (_req, res) => {
    res.type("application/yaml").send(spec.yaml);
  });

  router.get("/openapi.json", (_req, res) => {
    res.json(spec.document);
  });
}

export default router;
