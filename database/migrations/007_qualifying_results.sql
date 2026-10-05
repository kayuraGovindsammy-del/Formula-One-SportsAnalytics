-- Store official qualifying classification from Jolpica/Ergast.
CREATE TABLE IF NOT EXISTS qualifying_results (
  session_id VARCHAR(70) NOT NULL REFERENCES sessions(session_id),
  driver_id VARCHAR(10) NOT NULL REFERENCES drivers(driver_id),
  constructor_id VARCHAR(20) NOT NULL REFERENCES constructors(constructor_id),
  position INTEGER NOT NULL CHECK (position > 0),
  q1_time_ms INTEGER CHECK (q1_time_ms IS NULL OR q1_time_ms > 0),
  q2_time_ms INTEGER CHECK (q2_time_ms IS NULL OR q2_time_ms > 0),
  q3_time_ms INTEGER CHECK (q3_time_ms IS NULL OR q3_time_ms > 0),
  PRIMARY KEY (session_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_qualifying_results_session
  ON qualifying_results(session_id);
