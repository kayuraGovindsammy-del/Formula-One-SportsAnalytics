// ---------------------------------------------------------------------------
// Build step: copy docs/api/openapi.yaml into dist/.
//
// `npm start` runs `node dist/index.js`, and a deploy may ship only
// src/backend (or only dist/) — the repo-root docs/ directory is not
// guaranteed to be there. Copying the spec into the build output makes
// /api/docs work wherever dist/ goes, without the server having to reach
// outside its own package at runtime.
//
// Plain .mjs on purpose: it runs under `node` with no tsx/tsc involvement, so
// it works identically on Linux CI and Windows dev machines (the repo has
// PowerShell-only setup scripts, so `cp` in an npm script is not safe here).
//
// Fails loudly. A silently missing spec would turn into a 503 in production
// long after the build that caused it.
// ---------------------------------------------------------------------------

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_RELATIVE_PATH = join("docs", "api", "openapi.yaml");

const scriptDir = dirname(fileURLToPath(import.meta.url));
// tools/ sits at the package root, so the package root is one level up.
const packageRoot = resolve(scriptDir, "..");

/** Walks upward from the package root for the repo-root docs/api/openapi.yaml. */
function findSpec() {
  let current = packageRoot;

  for (;;) {
    const candidate = join(current, SPEC_RELATIVE_PATH);

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

const source = findSpec();

if (source === null) {
  console.error(
    `[copy-openapi-spec] Could not find ${SPEC_RELATIVE_PATH} walking up from ${packageRoot}.\n` +
      `The OpenAPI spec is required for /api/docs. Build aborted.`
  );
  process.exit(1);
}

const destinationDir = join(packageRoot, "dist");

if (!existsSync(destinationDir)) {
  console.error(
    `[copy-openapi-spec] ${destinationDir} does not exist — run tsc first. Build aborted.`
  );
  process.exit(1);
}

const destination = join(destinationDir, "openapi.yaml");

copyFileSync(source, destination);

console.log(`[copy-openapi-spec] ${source} -> ${destination}`);
