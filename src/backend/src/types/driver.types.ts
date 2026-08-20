// Matches data/sample/drivers.json entries and the `drivers` table in
// database/schema.sql.
export interface Driver {
  driver_id: string;
  permanent_number: number;
  given_name: string;
  family_name: string;
  nationality: string;
  date_of_birth: string;
  constructor_id: string;
}

// database/schema.sql `constructors` table.
export interface Constructor {
  constructor_id: string;
  name: string;
  nationality: string;
}

// `driver_constructor_links` table — team membership per season.
export interface DriverConstructorLink {
  season_id: string;
  driver_id: string;
  constructor_id: string;
}
