export const OPENF1_BASE_URL = "https://api.openf1.org/v1";

export interface OpenF1RaceSession {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  year: number;
}

export interface OpenF1Overtake {
  date: string;
  meeting_key: number;
  session_key: number;
  overtaking_driver_number: number;
  overtaken_driver_number: number;
  position: number;
}

export interface OpenF1Lap {
  date_start: string | null;
  driver_number: number;
  lap_number: number;
  session_key: number;
}

export interface PositionChangeRow {
  session_id: string;
  driver_id: string;
  overtaken_driver_id: string;
  lap_number: number;
  position_before: number;
  position_after: number;
}

export interface RaceOvertakeSummary {
  session_id: string;
  openf1_session_key: number;
  raw_overtakes: number;
  converted_rows: number;
  skipped_rows: number;
}

export interface OvertakeIngestPlan {
  rows: PositionChangeRow[];
  warnings: string[];
  matchedSessions: number;
  raceSummaries: RaceOvertakeSummary[];
}

export interface DatabaseRaceSession {
  session_id: string;
  race_date: string;
}

export interface DriverNumberMapping {
  driver_id: string;
  permanent_number: number;
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export class OpenF1Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenF1Error";
  }
}

function assertArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new OpenF1Error(`Unexpected OpenF1 response for ${label}: expected an array.`);
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function numberField(
  record: Record<string, unknown>,
  key: string,
  label: string
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new OpenF1Error(`Unexpected OpenF1 ${label}: '${key}' is not a number.`);
  }
  return value;
}

function stringField(
  record: Record<string, unknown>,
  key: string,
  label: string
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new OpenF1Error(`Unexpected OpenF1 ${label}: '${key}' is not a string.`);
  }
  return value;
}

function nullableStringField(
  record: Record<string, unknown>,
  key: string,
  label: string
): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new OpenF1Error(`Unexpected OpenF1 ${label}: '${key}' is not a string or null.`);
  }
  return value;
}

function parseRaceSessions(value: unknown): OpenF1RaceSession[] {
  return assertArray(value, "sessions").map((item, index) => {
    const record = asRecord(item);
    if (record === null) {
      throw new OpenF1Error(`Unexpected OpenF1 session at index ${index}.`);
    }
    return {
      session_key: numberField(record, "session_key", "session"),
      meeting_key: numberField(record, "meeting_key", "session"),
      session_name: stringField(record, "session_name", "session"),
      session_type: stringField(record, "session_type", "session"),
      date_start: stringField(record, "date_start", "session"),
      date_end: stringField(record, "date_end", "session"),
      year: numberField(record, "year", "session"),
    };
  });
}

function parseOvertakes(value: unknown): OpenF1Overtake[] {
  return assertArray(value, "overtakes").map((item, index) => {
    const record = asRecord(item);
    if (record === null) {
      throw new OpenF1Error(`Unexpected OpenF1 overtake at index ${index}.`);
    }
    return {
      date: stringField(record, "date", "overtake"),
      meeting_key: numberField(record, "meeting_key", "overtake"),
      session_key: numberField(record, "session_key", "overtake"),
      overtaking_driver_number: numberField(record, "overtaking_driver_number", "overtake"),
      overtaken_driver_number: numberField(record, "overtaken_driver_number", "overtake"),
      position: numberField(record, "position", "overtake"),
    };
  });
}

function parseLaps(value: unknown): OpenF1Lap[] {
  return assertArray(value, "laps").map((item, index) => {
    const record = asRecord(item);
    if (record === null) {
      throw new OpenF1Error(`Unexpected OpenF1 lap at index ${index}.`);
    }
    return {
      date_start: nullableStringField(record, "date_start", "lap"),
      driver_number: numberField(record, "driver_number", "lap"),
      lap_number: numberField(record, "lap_number", "lap"),
      session_key: numberField(record, "session_key", "lap"),
    };
  });
}

export interface OpenF1ClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  onProgress?: (message: string) => void;
  /** Free historical OpenF1 limit is 30 requests/minute. */
  minIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class OpenF1Client {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly onProgress: (message: string) => void;
  private readonly minIntervalMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastRequestAt = 0;

  constructor(options: OpenF1ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? OPENF1_BASE_URL;
    const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
    if (!fetchImpl) {
      throw new OpenF1Error("No fetch implementation available. Node 18+ is required.");
    }
    this.fetchImpl = fetchImpl;
    this.onProgress = options.onProgress ?? (() => undefined);
    this.minIntervalMs = options.minIntervalMs ?? 2100;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  private async get(path: string, query: URLSearchParams): Promise<unknown> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (this.lastRequestAt !== 0 && elapsed < this.minIntervalMs) {
      await this.sleep(this.minIntervalMs - elapsed);
    }
    const url = `${this.baseUrl}/${path}?${query.toString()}`;
    this.onProgress(`GET        ${url}`);
    this.lastRequestAt = Date.now();
    const response = await this.fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "f1-sport-analytics-overtake-ingest/1.0",
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new OpenF1Error(
        `OpenF1 request failed: ${response.status} ${url}${body ? ` — ${body}` : ""}`
      );
    }
    return response.json();
  }

  async fetchRaceSessions(year: number): Promise<OpenF1RaceSession[]> {
    const query = new URLSearchParams({
      year: String(year),
      session_name: "Race",
    });
    return parseRaceSessions(await this.get("sessions", query));
  }

  async fetchOvertakes(sessionKey: number): Promise<OpenF1Overtake[]> {
    const query = new URLSearchParams({ session_key: String(sessionKey) });
    return parseOvertakes(await this.get("overtakes", query));
  }

  async fetchLaps(sessionKey: number): Promise<OpenF1Lap[]> {
    const query = new URLSearchParams({ session_key: String(sessionKey) });
    return parseLaps(await this.get("laps", query));
  }
}

function utcDay(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new OpenF1Error(`Invalid date '${value}'.`);
  }
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Match a DB race date to the closest OpenF1 Race session. A one-day tolerance
 * handles night races whose UTC start falls on the following calendar day.
 */
export function matchRaceSessions(
  databaseSessions: readonly DatabaseRaceSession[],
  openF1Sessions: readonly OpenF1RaceSession[]
): Map<string, OpenF1RaceSession> {
  const unmatched = new Set(openF1Sessions.map((session) => session.session_key));
  const byKey = new Map(openF1Sessions.map((session) => [session.session_key, session]));
  const matches = new Map<string, OpenF1RaceSession>();
  const maxDifferenceMs = 24 * 60 * 60 * 1000;

  for (const databaseSession of [...databaseSessions].sort((a, b) =>
    a.race_date.localeCompare(b.race_date)
  )) {
    const targetDay = utcDay(databaseSession.race_date);
    let best: OpenF1RaceSession | undefined;
    let bestDiff = Number.POSITIVE_INFINITY;

    for (const key of unmatched) {
      const candidate = byKey.get(key);
      if (candidate === undefined) continue;
      const diff = Math.abs(utcDay(candidate.date_start) - targetDay);
      if (diff < bestDiff) {
        best = candidate;
        bestDiff = diff;
      }
    }

    if (best !== undefined && bestDiff <= maxDifferenceMs) {
      matches.set(databaseSession.session_id, best);
      unmatched.delete(best.session_key);
    }
  }

  return matches;
}

export function lapNumberAtTime(
  laps: readonly OpenF1Lap[],
  driverNumber: number,
  overtakeDate: string
): number | null {
  const target = new Date(overtakeDate).getTime();
  if (Number.isNaN(target)) return null;

  const driverLaps = laps
    .filter((lap) => lap.driver_number === driverNumber && lap.date_start !== null)
    .map((lap) => ({ lap, time: new Date(lap.date_start as string).getTime() }))
    .filter(({ time }) => !Number.isNaN(time))
    .sort((a, b) => a.time - b.time);

  if (driverLaps.length === 0) return null;

  let current = driverLaps[0]!.lap.lap_number;
  for (const entry of driverLaps) {
    if (entry.time > target) break;
    current = entry.lap.lap_number;
  }

  return Math.max(1, current);
}

export function toPositionChangeRows(
  sessionId: string,
  overtakes: readonly OpenF1Overtake[],
  laps: readonly OpenF1Lap[],
  driverIdByNumber: ReadonlyMap<number, string>,
  warnings: string[]
): PositionChangeRow[] {
  const rows: PositionChangeRow[] = [];
  const seen = new Set<string>();

  for (const overtake of [...overtakes].sort((a, b) => a.date.localeCompare(b.date))) {
    const driverId = driverIdByNumber.get(overtake.overtaking_driver_number);
    const overtakenDriverId = driverIdByNumber.get(overtake.overtaken_driver_number);

    if (driverId === undefined || overtakenDriverId === undefined) {
      warnings.push(
        `OpenF1 overtake in ${sessionId} could not map car ` +
          `${overtake.overtaking_driver_number} or ${overtake.overtaken_driver_number} to a driver_id`
      );
      continue;
    }

    const lapNumber = lapNumberAtTime(
      laps,
      overtake.overtaking_driver_number,
      overtake.date
    );

    if (lapNumber === null) {
      warnings.push(
        `OpenF1 overtake in ${sessionId} at ${overtake.date} has no matching lap for car ${overtake.overtaking_driver_number}`
      );
      continue;
    }

    const positionAfter = Math.trunc(overtake.position);
    if (positionAfter < 1) {
      warnings.push(`OpenF1 overtake in ${sessionId} has invalid position ${overtake.position}`);
      continue;
    }

    const row: PositionChangeRow = {
      session_id: sessionId,
      driver_id: driverId,
      overtaken_driver_id: overtakenDriverId,
      lap_number: lapNumber,
      position_before: positionAfter + 1,
      position_after: positionAfter,
    };

    const key = [
      row.session_id,
      row.driver_id,
      row.overtaken_driver_id,
      row.lap_number,
      row.position_before,
      row.position_after,
    ].join("|");

    if (!seen.has(key)) {
      seen.add(key);
      rows.push(row);
    }
  }

  return rows;
}

export interface OvertakePlanSource {
  fetchRaceSessions(year: number): Promise<OpenF1RaceSession[]>;
  fetchOvertakes(sessionKey: number): Promise<OpenF1Overtake[]>;
  fetchLaps(sessionKey: number): Promise<OpenF1Lap[]>;
}

export async function buildOvertakeIngestPlan(
  client: OvertakePlanSource,
  season: number,
  databaseSessions: readonly DatabaseRaceSession[],
  drivers: readonly DriverNumberMapping[]
): Promise<OvertakeIngestPlan> {
  const warnings: string[] = [];
  const openF1Sessions = await client.fetchRaceSessions(season);
  const matches = matchRaceSessions(databaseSessions, openF1Sessions);
  const driverIdByNumber = new Map<number, string>();

  for (const driver of drivers) {
    driverIdByNumber.set(driver.permanent_number, driver.driver_id);
  }

  const rows: PositionChangeRow[] = [];
  const raceSummaries: RaceOvertakeSummary[] = [];

  for (const databaseSession of databaseSessions) {
    const matched = matches.get(databaseSession.session_id);
    if (matched === undefined) {
      warnings.push(
        `No OpenF1 Race session matched ${databaseSession.session_id} (${databaseSession.race_date})`
      );
      continue;
    }

    // Sequential on purpose: the public historical tier is rate-limited.
    const overtakes = await client.fetchOvertakes(matched.session_key);
    const laps = await client.fetchLaps(matched.session_key);

    const convertedRows = toPositionChangeRows(
      databaseSession.session_id,
      overtakes,
      laps,
      driverIdByNumber,
      warnings
    );

    rows.push(...convertedRows);
    raceSummaries.push({
      session_id: databaseSession.session_id,
      openf1_session_key: matched.session_key,
      raw_overtakes: overtakes.length,
      converted_rows: convertedRows.length,
      skipped_rows: Math.max(0, overtakes.length - convertedRows.length),
    });
  }

  return { rows, warnings, matchedSessions: matches.size, raceSummaries };
}

export interface OvertakeQueryable {
  query<T = unknown>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

export async function readDatabaseRaceSessions(
  client: OvertakeQueryable,
  season: number
): Promise<DatabaseRaceSession[]> {
  const result = await client.query<DatabaseRaceSession>(
    `SELECT s.session_id, gp.race_date::text AS race_date
     FROM sessions s
     JOIN grand_prix gp ON gp.grand_prix_id = s.grand_prix_id
     WHERE gp.season_id = $1 AND s.type = 'RACE'
     ORDER BY gp.round`,
    [String(season)]
  );
  return result.rows;
}

export async function readDriverNumberMappings(
  client: OvertakeQueryable
): Promise<DriverNumberMapping[]> {
  const result = await client.query<DriverNumberMapping>(
    `SELECT driver_id, permanent_number
     FROM drivers
     WHERE permanent_number IS NOT NULL
     ORDER BY driver_id`
  );
  return result.rows;
}

export async function writePositionChanges(
  client: OvertakeQueryable,
  season: number,
  rows: readonly PositionChangeRow[]
): Promise<number> {
  await client.query("BEGIN");

  try {
    await client.query(
      `DELETE FROM position_changes pc
       USING sessions s, grand_prix gp
       WHERE pc.session_id = s.session_id
         AND s.grand_prix_id = gp.grand_prix_id
         AND gp.season_id = $1
         AND s.type = 'RACE'
         AND pc.submission_id IS NULL`,
      [String(season)]
    );

    let inserted = 0;
    for (const row of rows) {
      const result = await client.query(
        `INSERT INTO position_changes (
           session_id, driver_id, overtaken_driver_id, lap_number,
           position_before, position_after, submission_id
         )
         SELECT $1::varchar(70), $2::varchar(10), $3::varchar(10),
                $4::integer, $5::integer, $6::integer, NULL::bigint
         WHERE NOT EXISTS (
           SELECT 1
           FROM position_changes
           WHERE session_id = $1::varchar(70)
             AND driver_id = $2::varchar(10)
             AND overtaken_driver_id = $3::varchar(10)
             AND lap_number = $4::integer
             AND submission_id IS NOT NULL
         )`,
        [
          row.session_id,
          row.driver_id,
          row.overtaken_driver_id,
          row.lap_number,
          row.position_before,
          row.position_after,
        ]
      );
      inserted += result.rowCount ?? 0;
    }

    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export interface OvertakeDbClient extends OvertakeQueryable {
  release(): void;
}

export interface PoolLike {
  connect(): Promise<OvertakeDbClient>;
}

export async function ingestOvertakes(
  pool: PoolLike,
  client: OvertakePlanSource,
  season: number,
  dryRun = false
): Promise<{ plan: OvertakeIngestPlan; inserted: number | null }> {
  const database = await pool.connect();
  try {
    const [sessions, drivers] = await Promise.all([
      readDatabaseRaceSessions(database, season),
      readDriverNumberMappings(database),
    ]);
    const plan = await buildOvertakeIngestPlan(client, season, sessions, drivers);
    if (dryRun) return { plan, inserted: null };
    const inserted = await writePositionChanges(database, season, plan.rows);
    return { plan, inserted };
  } finally {
    database.release();
  }
}
