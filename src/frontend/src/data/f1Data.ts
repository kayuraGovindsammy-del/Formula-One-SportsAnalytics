import driversData from "../../../../data/sample/drivers.json";
import racesData from "../../../../data/sample/races.json";
import eventsData from "../../../../data/sample/events.json";

import {
  getConstructorName,
  CONSTRUCTOR_TEAM_NAMES,
} from "./constructors";

export interface Driver {
  driverId: string;
  number: number;
  name: string;
  team: string;
  constructorId: string;
  nationality: string;
  dateOfBirth: string;
}

export interface Race {
  round: number;
  name: string;
  circuitName: string;
  locality: string;
  country: string;
  date: string;
  hasSprint: boolean;
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
  constructorId: string;
  constructorName: string;
  laps: number;
  pitStops: number;
  gapToWinnerMs: number;
}

export interface RaceStatistics {
  round: number;
  sessionId: string;
  totalLaps: number;
  fastestLapDriverId: string;
  fastestLapDriverName: string;
  fastestLapNumber: number;
  fastestLapTimeMs: number;
  fastestLapTime: string;
  pitStops: number;
  overtakes: number;
  retirements: number;
  dnfs: number;
  classification: RaceResult[];
}

export interface RecentRace {
  round: number;
  name: string;
  circuitName: string;
  date: string;
  winner: string;
  fastestLapDriver: string;
  fastestLapTime: string;
}

export const drivers: Driver[] = driversData.drivers.map((driver) => ({
  driverId: driver.driver_id,
  number: driver.permanent_number,
  name: `${driver.given_name} ${driver.family_name}`,
  team: getConstructorName(driver.constructor_id),
  constructorId: driver.constructor_id,
  nationality: driver.nationality,
  dateOfBirth: driver.date_of_birth,
}));

export const races: Race[] = racesData.races.map((race) => ({
  round: race.round,
  name: race.race_name,
  circuitName: race.circuit_name,
  locality: race.locality,
  country: race.country,
  date: race.date,
  hasSprint: race.has_sprint,
}));

export function getDriverName(driverId: string): string {
  const driver = drivers.find(
    (item) => item.driverId === driverId
  );

  return driver?.name ?? driverId;
}

export function millisecondsToLapTime(
  milliseconds: number
): string {
  const minutes = Math.floor(milliseconds / 60000);

  const remainingMilliseconds =
    milliseconds % 60000;

  const seconds = Math.floor(
    remainingMilliseconds / 1000
  );

  const ms = remainingMilliseconds % 1000;

  return `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}.${ms
    .toString()
    .padStart(3, "0")}`;
}

export function millisecondsToGap(
  milliseconds: number
): string {
  if (milliseconds === 0) {
    return "Winner";
  }

  return `+${(milliseconds / 1000).toFixed(3)}s`;
}

const classification =
  eventsData.session_result.classification;

export const sampleDriverStandings: DriverStanding[] =
  classification.slice(0, 3).map((result) => ({
    position: result.position,
    driverId: result.driver_id,
    name: getDriverName(result.driver_id),
    team: getConstructorName(
      result.constructor_id
    ),
  }));

const constructorFinishCounts =
  classification.reduce<
    Record<
      string,
      {
        constructorId: string;
        finishes: number;
        bestPosition: number;
      }
    >
  >((accumulator, result) => {
    const existing =
      accumulator[result.constructor_id];

    if (!existing) {
      accumulator[result.constructor_id] = {
        constructorId:
          result.constructor_id,
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

export const sampleConstructorStandings: ConstructorStanding[] =
  Object.values(constructorFinishCounts)
    .sort(
      (a, b) =>
        a.bestPosition - b.bestPosition
    )
    .slice(0, 3)
    .map((constructor, index) => ({
      position: index + 1,
      constructorId:
        constructor.constructorId,
      name: getConstructorName(
        constructor.constructorId
      ),
      finishes: constructor.finishes,
    }));

const sampleRace = races.find(
  (race) =>
    race.round === eventsData.session.round
);

export const recentSampleRace: RecentRace = {
  round: eventsData.session.round,

  name:
    sampleRace?.name ??
    eventsData.session.race_name,

  circuitName:
    sampleRace?.circuitName ??
    "Circuit unavailable",

  date:
    sampleRace?.date ??
    eventsData.session.date,

  winner: getDriverName(
    classification[0].driver_id
  ),

  fastestLapDriver: getDriverName(
    eventsData.session_result.fastest_lap
      .driver_id
  ),

  fastestLapTime:
    millisecondsToLapTime(
      eventsData.session_result.fastest_lap
        .time_ms
    ),
};

const pitStopEvents =
  eventsData.events.filter(
    (event) => event.type === "PIT_STOP"
  );

const positionChangeEvents =
  eventsData.events.filter(
    (event) => event.type === "POSITION_CHANGE"
  );

const retirementEvents =
  eventsData.events.filter(
    (event) => event.type === "RETIREMENT"
  );

export const belgianGpStatistics: RaceStatistics = {
  round: eventsData.session.round,

  sessionId:
    eventsData.session.session_id,

  totalLaps:
    eventsData.session.total_laps,

  fastestLapDriverId:
    eventsData.session_result.fastest_lap
      .driver_id,

  fastestLapDriverName:
    getDriverName(
      eventsData.session_result.fastest_lap
        .driver_id
    ),

  fastestLapNumber:
    eventsData.session_result.fastest_lap
      .lap_number,

  fastestLapTimeMs:
    eventsData.session_result.fastest_lap
      .time_ms,

  fastestLapTime:
    millisecondsToLapTime(
      eventsData.session_result.fastest_lap
        .time_ms
    ),

  pitStops: pitStopEvents.length,

  overtakes: positionChangeEvents.length,

  retirements: retirementEvents.length,

  dnfs: retirementEvents.length,

  classification:
    classification.map((result) => ({
      position: result.position,

      driverId:
        result.driver_id,

      driverName:
        getDriverName(result.driver_id),

      constructorId:
        result.constructor_id,

      constructorName:
        getConstructorName(
          result.constructor_id
        ),

      laps:
        result.laps,

      pitStops:
        result.pit_stops,

      gapToWinnerMs:
        result.gap_to_winner_ms,
    })),
};

export const seasonSummary = {
  season: racesData.season,
  raceCount: races.length,
  driverCount: drivers.length,
  constructorCount:
    CONSTRUCTOR_TEAM_NAMES.length,
};