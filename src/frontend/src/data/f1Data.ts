const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "https://f1-sport-analytics-api-production.up.railway.app/api/v1";

export interface Driver {
  driverId: string;
  number: number;
  name: string;
  team: string;
  constructorId: string;
  nationality: string;
  dateOfBirth: string;
}

export interface DriverStatistics {
  driverId: string;
  season: string;
  racesEntered: number;
  wins: number;
  podiums: number;
  dnfCount: number;
  dnfRate: number | null;
  fastestLaps: number;
  averageFinishPosition: number | null;
  averageRacePaceMs: number | null;
  points: number | null;
  positionsGainedLostAvg: number | null;
}

export interface Race {
  grandPrixId: string;
  seasonId: string;
  round: number;
  name: string;
  circuitName: string;
  locality: string;
  country: string;
  date: string;
  hasSprint: boolean;
  hasResults: boolean;
}

export interface RaceDetail extends Race {
  sessions: Array<{
    sessionId: string;
    type: string;
    totalLaps: number | null;
    startTime: string | null;
    endTime: string | null;
  }>;
}

export interface DriverStanding {
  position: number;
  driverId: string;
  name: string;
  team: string;
}

export interface ConstructorStanding {
  position: number;
  constructorId: string;
  name: string;
  finishes: number;
}

export interface RaceResult {
  position: number;
  driverId: string;
  driverName: string;
  constructorId: string | null;
  constructorName: string;
  laps: number;
  pitStops: number;
  gapToWinnerMs: number | null;
}

export interface RaceStatistics {
  grandPrixId: string;
  sessionId: string;
  totalLaps: number | null;
  fastestLapDriverId: string | null;
  fastestLapDriverName: string;
  fastestLapNumber: number | null;
  fastestLapTimeMs: number | null;
  fastestLapTime: string;
  pitStops: number;
  overtakes: number;
  retirements: number;
  dnfs: number;
  classification: RaceResult[];
}

export interface RecentRace {
  grandPrixId: string;
  round: number;
  name: string;
  circuitName: string;
  locality: string;
  country: string;
  date: string;
  winner: string;
  fastestLapDriver: string;
  fastestLapTime: string;
}

interface ApiDriver {
  driver_id: string;
  permanent_number: number;
  given_name: string;
  family_name: string;
  nationality: string;
  date_of_birth: string;
  constructor_id: string;
  constructor_name: string;
}

interface ApiDriverStatistics {
  driver_id: string;
  season: string;
  races_entered: number;
  wins: number;
  podiums: number;
  dnf_count: number;
  dnf_rate: number | null;
  fastest_laps: number;
  average_finish_position: number | null;
  average_race_pace_ms: number | null;
  points: number | null;
  positions_gained_lost_avg: number | null;
}

interface ApiRace {
  grand_prix_id: string;
  season_id: string;
  round: number;
  race_name: string;
  circuit_id: string;
  circuit_name: string;
  locality: string;
  country: string;
  date: string;
  has_sprint: boolean;
  has_results?: boolean;
}

interface ApiRaceDetail extends ApiRace {
  sessions: Array<{
    session_id: string;
    type: string;
    total_laps: number | null;
    start_time: string | null;
    end_time: string | null;
  }>;
}

interface ApiClassificationRow {
  position: number;
  driver_id: string;
  constructor_id: string | null;
  laps: number;
  pit_stops: number;
  gap_to_winner_ms: number | null;
}

interface ApiFastestLap {
  driver_id: string;
  lap_number: number;
  lap_time_ms?: number;
  time_ms?: number;
}

interface ApiRaceStatistics {
  grand_prix_id: string;
  session_id: string;
  total_laps: number | null;
  fastest_lap: ApiFastestLap | null;
  pit_stop_count: number;
  overtake_count: number;
  retirement_count: number;
  dnf_count: number;
  classification: ApiClassificationRow[];
}

interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

function mapDriver(driver: ApiDriver): Driver {
  return {
    driverId: driver.driver_id,
    number: driver.permanent_number,
    name: `${driver.given_name} ${driver.family_name}`,
    team: driver.constructor_name,
    constructorId: driver.constructor_id,
    nationality: driver.nationality,
    dateOfBirth: driver.date_of_birth,
  };
}

function mapRace(race: ApiRace): Race {
  return {
    grandPrixId: race.grand_prix_id,
    seasonId: race.season_id,
    round: race.round,
    name: race.race_name,
    circuitName: race.circuit_name,
    locality: race.locality,
    country: race.country,
    date: race.date,
    hasSprint: race.has_sprint,
    hasResults: race.has_results ?? false,
  };
}

export function millisecondsToLapTime(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60000);
  const remainingMilliseconds = milliseconds % 60000;
  const seconds = Math.floor(remainingMilliseconds / 1000);
  const ms = remainingMilliseconds % 1000;

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${ms
    .toString()
    .padStart(3, "0")}`;
}

export function millisecondsToGap(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "N/A";
  }

  if (milliseconds === 0) {
    return "Winner";
  }

  return `+${(milliseconds / 1000).toFixed(3)}s`;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const result = (await response.json()) as ApiResponse<T> & {
    error?: string | { message?: string };
  };

  if (!response.ok) {
    const message =
      typeof result.error === "string"
        ? result.error
        : result.error?.message;

    throw new Error(
      message ?? `API request failed with status ${response.status}.`
    );
  }

  return result.data;
}

export async function fetchDrivers(): Promise<Driver[]> {
  const data = await apiGet<ApiDriver[]>("/drivers?per_page=100");
  return data.map(mapDriver);
}

export async function fetchDriver(driverId: string): Promise<Driver> {
  const data = await apiGet<ApiDriver>(
    `/drivers/${encodeURIComponent(driverId)}`
  );

  return mapDriver(data);
}

export async function fetchDriverStatistics(
  driverId: string,
  season = "2025"
): Promise<DriverStatistics> {
  const data = await apiGet<ApiDriverStatistics>(
    `/drivers/${encodeURIComponent(driverId)}/stats?season=${encodeURIComponent(
      season
    )}`
  );

  return {
    driverId: data.driver_id,
    season: data.season,
    racesEntered: data.races_entered,
    wins: data.wins,
    podiums: data.podiums,
    dnfCount: data.dnf_count,
    dnfRate: data.dnf_rate,
    fastestLaps: data.fastest_laps,
    averageFinishPosition: data.average_finish_position,
    averageRacePaceMs: data.average_race_pace_ms,
    points: data.points,
    positionsGainedLostAvg: data.positions_gained_lost_avg,
  };
}

export async function fetchRaces(): Promise<Race[]> {
  const data = await apiGet<ApiRace[]>("/races?per_page=100");
  return data.map(mapRace);
}

export async function fetchRace(grandPrixId: string): Promise<RaceDetail> {
  const data = await apiGet<ApiRaceDetail>(
    `/races/${encodeURIComponent(grandPrixId)}`
  );

  const mappedRace = mapRace(data);

  return {
    ...mappedRace,
    hasResults:
      data.has_results ??
      data.sessions.some((session) => session.type === "RACE"),
    sessions: data.sessions.map((session) => ({
      sessionId: session.session_id,
      type: session.type,
      totalLaps: session.total_laps,
      startTime: session.start_time,
      endTime: session.end_time,
    })),
  };
}

export async function fetchRaceStatistics(
  grandPrixId: string,
  drivers?: Driver[]
): Promise<RaceStatistics> {
  const statistics = await apiGet<ApiRaceStatistics>(
    `/races/${encodeURIComponent(grandPrixId)}/statistics`
  );

  const driverList = drivers ?? (await fetchDrivers());

  const driverName = (driverId: string | null): string => {
    if (!driverId) {
      return "Not available";
    }

    return (
      driverList.find((driver) => driver.driverId === driverId)?.name ??
      driverId
    );
  };

  const constructorName = (constructorId: string | null): string => {
    if (!constructorId) {
      return "Unknown";
    }

    return (
      driverList.find((driver) => driver.constructorId === constructorId)?.team ??
      constructorId
    );
  };

  const fastestLap = statistics.fastest_lap;
  const fastestLapMs = fastestLap
    ? fastestLap.time_ms ?? fastestLap.lap_time_ms ?? null
    : null;

  return {
    grandPrixId: statistics.grand_prix_id,
    sessionId: statistics.session_id,
    totalLaps: statistics.total_laps,
    fastestLapDriverId: fastestLap?.driver_id ?? null,
    fastestLapDriverName: fastestLap
      ? driverName(fastestLap.driver_id)
      : "Not available",
    fastestLapNumber: fastestLap?.lap_number ?? null,
    fastestLapTimeMs: fastestLapMs,
    fastestLapTime:
      fastestLapMs !== null
        ? millisecondsToLapTime(fastestLapMs)
        : "Not available",
    pitStops: statistics.pit_stop_count,
    overtakes: statistics.overtake_count,
    retirements: statistics.retirement_count,
    dnfs: statistics.dnf_count,
    classification: statistics.classification.map((result) => ({
      position: result.position,
      driverId: result.driver_id,
      driverName: driverName(result.driver_id),
      constructorId: result.constructor_id,
      constructorName: constructorName(result.constructor_id),
      laps: result.laps,
      pitStops: result.pit_stops,
      gapToWinnerMs: result.gap_to_winner_ms,
    })),
  };
}

export async function fetchSeasonSummary() {
  const [drivers, races] = await Promise.all([fetchDrivers(), fetchRaces()]);

  const constructorIds = new Set(
    drivers.map((driver) => driver.constructorId)
  );

  return {
    season: races[0]?.seasonId ?? "2025",
    raceCount: races.length,
    driverCount: drivers.length,
    constructorCount: constructorIds.size,
  };
}

export async function fetchFeaturedRace(): Promise<{
  race: RecentRace;
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];
  statistics: RaceStatistics;
}> {
  const [drivers, races] = await Promise.all([fetchDrivers(), fetchRaces()]);

  const featuredRace = races.find((race) => race.hasResults);

  if (!featuredRace) {
    throw new Error("No race with statistics is available.");
  }

  const statistics = await fetchRaceStatistics(
    featuredRace.grandPrixId,
    drivers
  );

  const driverStandings = statistics.classification
    .slice(0, 3)
    .map((result) => ({
      position: result.position,
      driverId: result.driverId,
      name: result.driverName,
      team: result.constructorName,
    }));

  const constructors = statistics.classification.reduce<
    Record<
      string,
      {
        constructorId: string;
        name: string;
        finishes: number;
        bestPosition: number;
      }
    >
  >((accumulator, result) => {
    if (!result.constructorId) {
      return accumulator;
    }

    const existing = accumulator[result.constructorId];

    if (!existing) {
      accumulator[result.constructorId] = {
        constructorId: result.constructorId,
        name: result.constructorName,
        finishes: 1,
        bestPosition: result.position,
      };
    } else {
      existing.finishes += 1;
      existing.bestPosition = Math.min(
        existing.bestPosition,
        result.position
      );
    }

    return accumulator;
  }, {});

  const constructorStandings = Object.values(constructors)
    .sort((a, b) => a.bestPosition - b.bestPosition)
    .slice(0, 3)
    .map((constructor, index) => ({
      position: index + 1,
      constructorId: constructor.constructorId,
      name: constructor.name,
      finishes: constructor.finishes,
    }));

  const winner = statistics.classification[0];

  return {
    race: {
      grandPrixId: featuredRace.grandPrixId,
      round: featuredRace.round,
      name: featuredRace.name,
      circuitName: featuredRace.circuitName,
      locality: featuredRace.locality,
      country: featuredRace.country,
      date: featuredRace.date,
      winner: winner?.driverName ?? "Not available",
      fastestLapDriver: statistics.fastestLapDriverName,
      fastestLapTime: statistics.fastestLapTime,
    },
    driverStandings,
    constructorStandings,
    statistics,
  };
}