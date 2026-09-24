import "dotenv/config";
import { getPool } from "../config/database.js";
import {
  ingestOvertakes,
  OpenF1Client,
} from "../ingestion/openF1Overtakes.js";

function usage(): never {
  console.error(
    "Usage: npm run ingest:overtakes -- --season <year> [--dry-run]"
  );
  process.exit(2);
}

const args = process.argv.slice(2);
const seasonIndex = args.indexOf("--season");
const seasonText = seasonIndex >= 0 ? args[seasonIndex + 1] : undefined;
const dryRun = args.includes("--dry-run");

if (seasonText === undefined || !/^\d{4}$/.test(seasonText)) usage();
const season = Number(seasonText);

const pool = getPool();
const client = new OpenF1Client({
  onProgress: (message) => console.log(`  ${message}`),
});

try {
  console.log(`Ingesting OpenF1 position changes for ${season}${dryRun ? " [dry run]" : ""}`);
  const { plan, inserted } = await ingestOvertakes(pool, client, season, dryRun);

  console.log(`\nMatched race sessions: ${plan.matchedSessions}`);

  let totalRaw = 0;
  let totalConverted = 0;
  let totalSkipped = 0;

  console.log("\nPer-race breakdown:");
  for (const summary of plan.raceSummaries) {
    totalRaw += summary.raw_overtakes;
    totalConverted += summary.converted_rows;
    totalSkipped += summary.skipped_rows;

    console.log(
      `  ${summary.session_id}: raw=${summary.raw_overtakes}, ` +
      `converted=${summary.converted_rows}, skipped=${summary.skipped_rows}, ` +
      `openf1_session=${summary.openf1_session_key}`
    );
  }

  console.log(`\nRaw OpenF1 overtakes: ${totalRaw}`);
  console.log(`Position changes planned: ${totalConverted}`);
  console.log(`Skipped/deduplicated: ${totalSkipped}`);

  for (const warning of plan.warnings) {
    console.log(`WARNING: ${warning}`);
  }

  if (dryRun) {
    console.log("\nDry run — nothing was written.");
  } else {
    console.log(`\nInserted ${inserted ?? 0} source position_changes. Done.`);
  }
} catch (error) {
  console.error(
    `\nOvertake ingest failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
