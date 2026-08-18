import driversData from "../../../../data/sample/drivers.json";
import racesData from "../../../../data/sample/races.json";
import { getConstructorName } from "./constructors";

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
