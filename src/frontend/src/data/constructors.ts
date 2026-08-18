// drivers.json only carries each driver's constructor_id (team code); the full
// team names aren't in the sample data, so they're looked up here for display.
const CONSTRUCTOR_NAMES: Record<string, string> = {
  RBR: "Red Bull Racing",
  MCL: "McLaren",
  FER: "Ferrari",
  MER: "Mercedes",
  AMR: "Aston Martin",
  WIL: "Williams",
  RB: "Racing Bulls",
  HAA: "Haas F1 Team",
  ALP: "Alpine",
  SAU: "Kick Sauber",
};

export function getConstructorName(constructorId: string): string {
  return CONSTRUCTOR_NAMES[constructorId] ?? constructorId;
}

export const CONSTRUCTOR_TEAM_NAMES = Object.values(CONSTRUCTOR_NAMES);
