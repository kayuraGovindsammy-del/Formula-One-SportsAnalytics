-- Formula 1 Sports Analytics — initial PostgreSQL schema
-- Sprint 1 foundation. Statistics are derived from event data.

CREATE TYPE user_role AS ENUM ('USER', 'SUBMITTER', 'ADMIN');
CREATE TYPE submitter_status AS ENUM (
  'NONE',
  'PENDING',
  'APPROVED',
  'REJECTED'
);
CREATE TYPE session_type AS ENUM (
  'PRACTICE_1', 'PRACTICE_2', 'PRACTICE_3',
  'QUALIFYING', 'SPRINT_QUALIFYING', 'SPRINT', 'RACE'
);
CREATE TYPE submission_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE penalty_type AS ENUM ('TIME', 'GRID_DROP', 'DISQUALIFICATION');
CREATE TYPE result_status AS ENUM ('FINISHED', 'DNF', 'DSQ');

CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  auth_uid VARCHAR(128) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(120),
  role user_role NOT NULL DEFAULT 'USER',
  submitter_status submitter_status NOT NULL DEFAULT 'NONE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE seasons (
  season_id VARCHAR(10) PRIMARY KEY,
  year INTEGER UNIQUE NOT NULL CHECK (year >= 1950)
);

CREATE TABLE circuits (
  circuit_id VARCHAR(50) PRIMARY KEY,
  circuit_name VARCHAR(120) NOT NULL,
  locality VARCHAR(120),
  country VARCHAR(120) NOT NULL
);

CREATE TABLE grand_prix (
  grand_prix_id VARCHAR(50) PRIMARY KEY,
  season_id VARCHAR(10) NOT NULL REFERENCES seasons(season_id),
  round INTEGER NOT NULL CHECK (round > 0),
  race_name VARCHAR(150) NOT NULL,
  circuit_id VARCHAR(50) NOT NULL REFERENCES circuits(circuit_id),
  race_date DATE NOT NULL,
  has_sprint BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (season_id, round)
);

CREATE TABLE sessions (
  session_id VARCHAR(70) PRIMARY KEY,
  grand_prix_id VARCHAR(50) NOT NULL REFERENCES grand_prix(grand_prix_id),
  type session_type NOT NULL,
  total_laps INTEGER CHECK (total_laps IS NULL OR total_laps >= 0),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  UNIQUE (grand_prix_id, type)
);

CREATE TABLE drivers (
  driver_id VARCHAR(10) PRIMARY KEY,
  permanent_number INTEGER,
  given_name VARCHAR(80) NOT NULL,
  family_name VARCHAR(80) NOT NULL,
  nationality VARCHAR(80),
  date_of_birth DATE
);

CREATE TABLE constructors (
  constructor_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  nationality VARCHAR(80)
);

CREATE TABLE driver_constructor_links (
  season_id VARCHAR(10) NOT NULL REFERENCES seasons(season_id),
  driver_id VARCHAR(10) NOT NULL REFERENCES drivers(driver_id),
  constructor_id VARCHAR(20) NOT NULL REFERENCES constructors(constructor_id),
  PRIMARY KEY (season_id, driver_id, constructor_id)
);

CREATE TABLE submissions (
  submission_id BIGSERIAL PRIMARY KEY,
  submitter_user_id BIGINT NOT NULL REFERENCES users(user_id),
  session_id VARCHAR(70) NOT NULL REFERENCES sessions(session_id),
  status submission_status NOT NULL DEFAULT 'PENDING',
  event_data JSONB NOT NULL,
  source_filename VARCHAR(255),
  validation_message TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by BIGINT REFERENCES users(user_id)
);

CREATE TABLE laps (
  session_id VARCHAR(70) NOT NULL REFERENCES sessions(session_id),
  driver_id VARCHAR(10) NOT NULL REFERENCES drivers(driver_id),
  lap_number INTEGER NOT NULL CHECK (lap_number > 0),
  lap_time_ms INTEGER CHECK (lap_time_ms IS NULL OR lap_time_ms > 0),
  position INTEGER CHECK (position IS NULL OR position > 0),
  is_pit_lap BOOLEAN NOT NULL DEFAULT FALSE,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  submission_id BIGINT REFERENCES submissions(submission_id),
  PRIMARY KEY (session_id, driver_id, lap_number)
);

CREATE TABLE pit_stops (
  pit_stop_id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(70) NOT NULL REFERENCES sessions(session_id),
  driver_id VARCHAR(10) NOT NULL REFERENCES drivers(driver_id),
  lap_number INTEGER NOT NULL CHECK (lap_number > 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms > 0),
  submission_id BIGINT REFERENCES submissions(submission_id)
);

CREATE TABLE position_changes (
  position_change_id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(70) NOT NULL REFERENCES sessions(session_id),
  driver_id VARCHAR(10) NOT NULL REFERENCES drivers(driver_id),
  overtaken_driver_id VARCHAR(10) REFERENCES drivers(driver_id),
  lap_number INTEGER NOT NULL CHECK (lap_number > 0),
  position_before INTEGER CHECK (position_before > 0),
  position_after INTEGER CHECK (position_after > 0),
  submission_id BIGINT REFERENCES submissions(submission_id)
);

CREATE TABLE penalties (
  penalty_id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(70) NOT NULL REFERENCES sessions(session_id),
  driver_id VARCHAR(10) NOT NULL REFERENCES drivers(driver_id),
  lap_number INTEGER CHECK (lap_number IS NULL OR lap_number > 0),
  penalty_type penalty_type NOT NULL,
  duration_ms INTEGER,
  reason TEXT,
  submission_id BIGINT REFERENCES submissions(submission_id)
);

CREATE TABLE retirements (
  retirement_id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(70) NOT NULL REFERENCES sessions(session_id),
  driver_id VARCHAR(10) NOT NULL REFERENCES drivers(driver_id),
  lap_number INTEGER CHECK (lap_number IS NULL OR lap_number >= 0),
  reason TEXT,
  submission_id BIGINT REFERENCES submissions(submission_id),
  UNIQUE (session_id, driver_id)
);

-- Derived table: do not treat this as manually entered source data.
CREATE TABLE race_results (
  session_id VARCHAR(70) NOT NULL REFERENCES sessions(session_id),
  driver_id VARCHAR(10) NOT NULL REFERENCES drivers(driver_id),
  constructor_id VARCHAR(20) NOT NULL REFERENCES constructors(constructor_id),
  position INTEGER CHECK (position IS NULL OR position > 0),
  grid_position INTEGER CHECK (grid_position IS NULL OR grid_position >= 0),
  points NUMERIC(6,2) NOT NULL DEFAULT 0,
  laps_completed INTEGER NOT NULL DEFAULT 0,
  pit_stops INTEGER NOT NULL DEFAULT 0 CHECK (pit_stops >= 0),
  gap_to_winner_ms INTEGER CHECK (gap_to_winner_ms IS NULL OR gap_to_winner_ms >= 0),
  status result_status NOT NULL,
  PRIMARY KEY (session_id, driver_id)
);

CREATE INDEX idx_sessions_grand_prix ON sessions(grand_prix_id);
CREATE INDEX idx_laps_driver ON laps(driver_id);
CREATE INDEX idx_laps_session ON laps(session_id);
CREATE INDEX idx_submissions_submitter ON submissions(submitter_user_id);
CREATE INDEX idx_submissions_status ON submissions(status);
