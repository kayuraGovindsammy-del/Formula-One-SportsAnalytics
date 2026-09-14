// ---------------------------------------------------------------------------
// Locates and loads docs/api/openapi.yaml.
//
// The spec lives OUTSIDE src/backend, at the repo root, so a single relative
// path is not enough: the file sits in a different place depending on how the
// process was started.
//
//   tsx / vitest   cwd is src/backend, the repo is fully checked out
//                  -> found by walking up to <repo>/docs/api/openapi.yaml
//   node dist/     only src/backend (or only dist/) may have been deployed
//                  -> found at dist/openapi.yaml, copied there by
//                     tools/copy-openapi-spec.mjs during `npm run build`
//
// Both candidates are resolved against THIS MODULE's location rather than
// process.cwd(), so the result does not change with the directory the server
// happens to be started from. Same approach as models/sampleData.ts.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** The filename as it appears both at the repo root and in the build output. */
export const SPEC_FILENAME = "openapi.yaml";

/**
 * Every place the spec might legitimately be, most specific first.
 * Exported for the test, which asserts the build-output candidate is present.
 */
export function specCandidatePaths(startDir: string = moduleDir): string[] {
  const candidates: string[] = [
    // Build output. This module compiles to dist/config/openapiSpec.js, so
    // one level up is dist/ — where the build step drops the copy.
    resolve(startDir, "..", SPEC_FILENAME),
  ];

  // Repo checkout: walk upward looking for docs/api/openapi.yaml. Covers
  // `npm run dev`, `npm test` and running from the repo root alike.
  let current = startDir;

  for (;;) {
    candidates.push(join(current, "docs", "api", SPEC_FILENAME));

    const parent = dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return candidates;
}

export interface OpenApiSpec {
  /** Absolute path the spec was read from. */
  path: string;
  /** Raw YAML source, served verbatim at /api/openapi.yaml. */
  yaml: string;
  /** Parsed document, served at /api/openapi.json and given to Swagger UI. */
  document: Record<string, unknown>;
}

function isSpecDocument(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof Reflect.get(value, "openapi") === "string" &&
    typeof Reflect.get(value, "paths") === "object"
  );
}

// Read and parsed once per process, not per request.
let cached: OpenApiSpec | null | undefined;

/**
 * Returns the spec, or null when it cannot be found or is unreadable.
 *
 * Deliberately does not throw: a missing docs file must not take the API
 * down with it. The docs routes turn a null into a 503 carrying the project's
 * standard error envelope, and every other route is unaffected.
 */
export function loadOpenApiSpec(): OpenApiSpec | null {
  if (cached !== undefined) {
    return cached;
  }

  cached = readOpenApiSpec();

  return cached;
}

function readOpenApiSpec(): OpenApiSpec | null {
  const candidates = specCandidatePaths();
  const specPath = candidates.find((candidate) => existsSync(candidate));

  if (specPath === undefined) {
    console.error(
      `OpenAPI spec not found. /api/docs will be unavailable. Looked in:\n  ${candidates.join(
        "\n  "
      )}`
    );

    return null;
  }

  try {
    const yaml = readFileSync(specPath, "utf8");
    const parsed: unknown = parse(yaml);

    if (!isSpecDocument(parsed)) {
      console.error(
        `OpenAPI spec at ${specPath} is not an OpenAPI document ` +
          `(expected string 'openapi' and object 'paths').`
      );

      return null;
    }

    return { path: specPath, yaml, document: parsed };
  } catch (error) {
    console.error(`OpenAPI spec at ${specPath} could not be read:`, error);

    return null;
  }
}

/** Test seam — forces the next loadOpenApiSpec() to re-read from disk. */
export function resetOpenApiSpecCache(): void {
  cached = undefined;
}
