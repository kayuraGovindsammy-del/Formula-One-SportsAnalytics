// ---------------------------------------------------------------------------
// Plain-language definitions of the statistics the chat tools report, for
// the get_stat_definitions tool.
//
// Keep these in step with docs/f1-statistics.md and with how
// services/driverStatistics.ts and constructorStatistics.ts calculate them:
// the assistant may only explain a statistic the way this app computes it.
// ---------------------------------------------------------------------------

export interface StatDefinition {
  name: string;
  /** The tool-result fields this definition explains. */
  fields: readonly string[];
  definition: string;
}

export const STAT_DEFINITIONS = {
  positions_gained: {
    name: "Positions gained/lost",
    fields: ["positions_gained_lost_avg"],
    definition:
      "For each race, the starting grid position minus the finishing position, so a positive number means places gained and a negative one places lost. The season figure is the average over the races where both are known. The grid comes from qualifying when we have it, otherwise from the published starting grid; a pit-lane start is skipped rather than guessed.",
  },
  average_finish: {
    name: "Average finish",
    fields: ["average_finish_position"],
    definition:
      "The average finishing position across the races where the driver was classified. Lower is better. Retirements, disqualifications and non-starts have no finishing position, so they are left out rather than counted as last.",
  },
  dnf: {
    name: "DNF (did not finish)",
    fields: ["dnf_count", "dnfs", "dnf_rate"],
    definition:
      "A race the driver retired from. Disqualifications and not starting are not DNFs; disqualifications are counted separately. The DNF rate is DNFs divided by races entered.",
  },
  disqualification: {
    name: "Disqualification (DSQ)",
    fields: ["disqualifications"],
    definition:
      "A race where the driver's published result is a disqualification. It is counted separately from DNFs, and a disqualified driver has no finishing position.",
  },
  fastest_lap: {
    name: "Fastest lap",
    fields: ["fastest_laps", "fastest_lap"],
    definition:
      "The quickest valid racing lap of a race; in-laps, out-laps and invalid laps don't count. For races without lap-by-lap data, the published fastest-lap holder is used. No bonus point is added for it.",
  },
  points: {
    name: "Points",
    fields: ["points"],
    definition:
      "A driver's points are the published Grand Prix points for each race, added up over the season; a race with no published result uses the standard 25-18-15-12-10-8-6-4-2-1 scale. Team points add up the points each car scored for that team in each race. Sprint races are not in our data, so totals can be lower than the official championship.",
  },
  pit_stop_time: {
    name: "Pit stop time",
    fields: ["duration"],
    definition:
      "The time a driver spent in the pit lane, from pit entry to pit exit, as published. It is not the time the car was stationary, which is much shorter.",
  },
  wins: {
    name: "Wins",
    fields: ["wins"],
    definition:
      "Races finished in first place. The finishing position comes from lap-by-lap data when we have it, otherwise from the published race result.",
  },
  podiums: {
    name: "Podiums",
    fields: ["podiums"],
    definition: "Races finished in the top three, from the same finishing positions as wins.",
  },
  race_pace: {
    name: "Average race pace",
    fields: ["average_race_pace"],
    definition:
      "The average time of the driver's valid racing laps, excluding pit laps. It needs lap-by-lap data, so it is empty for most races.",
  },
} as const satisfies Record<string, StatDefinition>;

export type StatKey = keyof typeof STAT_DEFINITIONS;

export const STAT_KEYS = Object.keys(STAT_DEFINITIONS) as [StatKey, ...StatKey[]];
