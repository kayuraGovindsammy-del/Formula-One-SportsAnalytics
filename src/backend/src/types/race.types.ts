// database/schema.sql `circuits` table.
export interface Circuit {
  circuit_id: string;
  circuit_name: string;
  locality: string;
  country: string;
}

// Matches data/sample/races.json entries — flattened with circuit fields
// inline, the way the sample data ships them. `grand_prix_id` isn't present
// in the sample file (only `round`); the derived form is `{season}_R{round}`,
// matching docs/data-model.md's example ("2025_R13").
export interface Race {
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
}

// database/schema.sql `seasons` table.
export interface Season {
  season_id: string;
  year: number;
}
