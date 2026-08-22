import {
  rawSessionResult,
  rawSessionSummary,
  seasonId,
  toGrandPrixId,
} from "./sampleData.js";

export interface RaceResultRow {
  position: number;
  driver_id: string;
  constructor_id: string;
  laps: number;
  pit_stops: number;
  gap_to_winner_ms: number;
}

export interface RaceResultData {
  fastest_lap: {
    driver_id: string;
    lap_number: number;
    time_ms: number;
  };

  classification: RaceResultRow[];
}

export async function findByRace(
  grandPrixId: string
): Promise<RaceResultData | null> {
  const sampleGrandPrixId = toGrandPrixId(
    seasonId,
    rawSessionSummary.round
  );

  if (
    sampleGrandPrixId.toLowerCase() !==
    grandPrixId.toLowerCase()
  ) {
    return null;
  }

  return {
    fastest_lap: {
      driver_id:
        rawSessionResult.fastest_lap.driver_id,

      lap_number:
        rawSessionResult.fastest_lap.lap_number,

      time_ms:
        rawSessionResult.fastest_lap.time_ms,
    },

    classification:
      rawSessionResult.classification.map(
        (result) => ({
          position: result.position,
          driver_id: result.driver_id,
          constructor_id:
            result.constructor_id,
          laps: result.laps,
          pit_stops: result.pit_stops,
          gap_to_winner_ms:
            result.gap_to_winner_ms,
        })
      ),
  };
}