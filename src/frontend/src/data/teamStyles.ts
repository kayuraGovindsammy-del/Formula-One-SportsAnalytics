export interface TeamStyle {
  primary: string;
  secondary: string;
}

export const TEAM_STYLES: Record<string, TeamStyle> = {
  MCL: {
    primary: "#FF8700",
    secondary: "#111111",
  },

  FER: {
    primary: "#E8002D",
    secondary: "#FFFFFF",
  },

  MER: {
    primary: "#27F4D2",
    secondary: "#111111",
  },

  RBR: {
    primary: "#152B5B",
    secondary: "#FFFFFF",
  },

  AMR: {
    primary: "#229971",
    secondary: "#FFFFFF",
  },

  WIL: {
    primary: "#64C4FF",
    secondary: "#111111",
  },

  RB: {
    primary: "#6692FF",
    secondary: "#FFFFFF",
  },

  HAA: {
    primary: "#818486",
    secondary: "#111111",
  },

  ALP: {
    primary: "#FF87BC",
    secondary: "#111111",
  },

  SAU: {
    primary: "#52E252",
    secondary: "#111111",
  },
};

export function getTeamStyle(constructorId: string): TeamStyle {
  return (
    TEAM_STYLES[constructorId] ?? {
      primary: "#E10600",
      secondary: "#FFFFFF",
    }
  );
}