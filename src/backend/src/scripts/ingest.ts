import "dotenv/config";
import { getPool } from "../config/database.js";
import { UsageError, parseArgs, runIngest } from "../ingestion/cli.js";

// process.argv[0] is node, [1] is this script — the flags start at 2.
let options;

try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    console.error(error.message);
    process.exit(2);
  }

  throw error;
}

// A dry run needs no database, so it must not require DATABASE_URL to be set.
const pool = options.dryRun ? null : getPool();

try {
  await runIngest({
    options,
    pool: pool ?? {
      connect: () => {
        throw new Error("A database connection is not available in dry-run mode.");
      },
    },
  });
} catch (error) {
  console.error(
    `\nIngest failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
