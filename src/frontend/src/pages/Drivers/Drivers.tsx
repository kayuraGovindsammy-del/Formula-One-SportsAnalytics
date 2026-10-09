import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DatasetDownloads from "../../components/DatasetDownloads";
import DriverCard from "../../components/DriverCard";

import {
  fetchDriverStatistics,
  fetchDrivers,
  type Driver,
} from "../../data/f1Data";

import "./Drivers.css";

const SEASON = "2025";

type DriverWithStanding = Driver & {
  points: number | null;
  rank: number | null;
};

function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [pointsByDriver, setPointsByDriver] = useState<
    Record<string, number | null>
  >({});

 const [searchParams, setSearchParams] = useSearchParams();

const searchTerm =
  searchParams.get("search") ?? "";

const selectedTeam =
  searchParams.get("team") ?? "All Teams";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        setLoading(true);
        setError("");

        const driverData = await fetchDrivers();

        setDrivers(driverData);

        const results = await Promise.allSettled(
          driverData.map((driver) =>
            fetchDriverStatistics(
              driver.driverId,
              SEASON
            )
          )
        );

        const points: Record<
          string,
          number | null
        > = {};

        results.forEach((result, index) => {
          const driver = driverData[index];

          if (!driver) {
            return;
          }

          points[driver.driverId] =
            result.status === "fulfilled"
              ? result.value.points
              : null;
        });

        setPointsByDriver(points);
      } catch (err) {
        console.error(
          "Failed to load drivers:",
          err
        );

        setError(
          "Failed to load drivers from the API."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadDrivers();
  }, []);

  const teams = useMemo(
    () =>
      Array.from(
        new Set(
          drivers.map(
            (driver) => driver.team
          )
        )
      ).sort((a, b) =>
        a.localeCompare(b)
      ),
    [drivers]
  );

  /*
   * Build championship standings first.
   *
   * Rank is based on points,
   * but the page itself will still
   * display drivers alphabetically.
   */
  const standings: DriverWithStanding[] =
    drivers
      .map((driver) => ({
        ...driver,
        points:
          pointsByDriver[
            driver.driverId
          ] ?? null,
      }))
      .sort((a, b) => {
        if (
          a.points === null &&
          b.points === null
        ) {
          return 0;
        }

        if (a.points === null) {
          return 1;
        }

        if (b.points === null) {
          return -1;
        }

        return b.points - a.points;
      })
      .map((driver, index) => ({
        ...driver,

        rank:
          driver.points !== null
            ? index + 1
            : null,
      }));

  /*
   * Search/filter after rankings
   * are calculated so P1/P2/etc.
   * don't change when filtering.
   *
   * Finally sort cards alphabetically.
   */
  const filteredDrivers = standings
    .filter((driver) => {
      const matchesSearch =
        driver.name
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          );

      const matchesTeam =
        selectedTeam === "All Teams" ||
        driver.team === selectedTeam;

      return (
        matchesSearch &&
        matchesTeam
      );
    })

  if (loading) {
    return (
      <main>
        <h1>{SEASON} Drivers</h1>

        <p>Loading drivers...</p>
      </main>
    );
  }

  return (
    <main>
      <section>
        <h1>{SEASON} Drivers</h1>

        <p>
          Browse drivers competing in the{" "}
          {SEASON} Formula 1 season.
        </p>

        <DatasetDownloads
          dataset="drivers"
          season={SEASON}
          label="drivers"
        />
      </section>

      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}

      <section className="driver-controls">
        <div className="driver-search">
          <span
            className="driver-search-icon"
            aria-hidden="true"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle
                cx="11"
                cy="11"
                r="8"
              />

              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>

          <input
            type="search"
            placeholder="Search drivers..."
            value={searchTerm}
            onChange={(event) => {
  const next =
    new URLSearchParams(searchParams);

  const value =
    event.target.value;

  if (value) {
    next.set("search", value);
  } else {
    next.delete("search");
  }

  setSearchParams(next, {
    replace: true,
  });
}}
            aria-label="Search drivers"
          />
        </div>

        <select
          value={selectedTeam}
onChange={(event) => {
  const next =
    new URLSearchParams(searchParams);

  const value =
    event.target.value;

  if (value === "All Teams") {
    next.delete("team");
  } else {
    next.set("team", value);
  }

  setSearchParams(next, {
    replace: true,
  });
}}
          aria-label="Filter drivers by team"
        >
          <option value="All Teams">
            All Teams
          </option>

          {teams.map((team) => (
            <option
              key={team}
              value={team}
            >
              {team}
            </option>
          ))}
        </select>
      </section>

      <p className="results-count">
        Showing{" "}
        {filteredDrivers.length} driver
        {filteredDrivers.length !== 1
          ? "s"
          : ""}
      </p>

      <section className="drivers-grid">
        {filteredDrivers.map(
          (driver) => (
            <DriverCard
              key={driver.driverId}
              driverId={
                driver.driverId
              }
              name={driver.name}
              team={driver.team}
              constructorId={
                driver.constructorId
              }
              number={driver.number}
              nationality={
                driver.nationality
              }
              dateOfBirth={
                driver.dateOfBirth
              }
              points={driver.points}
              rank={driver.rank}
            />
          )
        )}
      </section>
    </main>
  );
}

export default Drivers;