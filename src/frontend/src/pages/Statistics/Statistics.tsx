import { useEffect, useState } from "react";

import StatCard from "../../components/StatCard";

import {
  fetchDrivers,
  fetchRaces,
  fetchRaceStatistics,
  type Driver,
  type Race,
  type RaceStatistics,
} from "../../data/f1Data";

import {
  CONSTRUCTOR_TEAM_NAMES,
} from "../../data/constructors";

function Statistics() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [raceStats, setRaceStats] =
    useState<RaceStatistics | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStatistics = async () => {
      try {
        setLoading(true);
        setError("");

        const [driverData, raceData] =
          await Promise.all([
            fetchDrivers(),
            fetchRaces(),
          ]);

        setDrivers(driverData);
        setRaces(raceData);

        /*
         * Use the Belgian Grand Prix if it exists.
         * Otherwise use the first available race.
         */
        const belgianRace =
          raceData.find(
            (race) =>
              race.name
                .toLowerCase()
                .includes("belgian")
          ) ?? raceData[0];

        if (belgianRace) {
          try {
            const statistics =
              await fetchRaceStatistics(
                belgianRace.grandPrixId
              );

            setRaceStats(statistics);
          } catch (statisticsError) {
            console.error(
              "Failed to load race statistics:",
              statisticsError
            );
          }
        }
      } catch (err) {
        console.error(
          "Failed to load statistics:",
          err
        );

        setError(
          "Failed to load Formula 1 statistics."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadStatistics();
  }, []);

  if (loading) {
    return (
      <main>
        <section>
          <h1>2025 Statistics</h1>
          <p>Loading statistics...</p>
        </section>
      </main>
    );
  }

  const selectedRace =
    races.find(
      (race) =>
        race.grandPrixId ===
        raceStats?.grandPrixId
    ) ??
    races.find((race) =>
      race.name
        .toLowerCase()
        .includes("belgian")
    );

  const classification =
    raceStats?.classification ?? [];

  const topDrivers =
    classification.slice(0, 3);

  const constructorResults =
    classification.reduce<
      Record<
        string,
        {
          constructorId: string;
          constructorName: string;
          finishes: number;
          bestPosition: number;
        }
      >
    >((accumulator, result) => {
      const existing =
        accumulator[result.constructorId];

      if (!existing) {
        accumulator[result.constructorId] = {
          constructorId:
            result.constructorId,

          constructorName:
            result.constructorName,

          finishes: 1,

          bestPosition:
            result.position,
        };
      } else {
        existing.finishes += 1;

        existing.bestPosition =
          Math.min(
            existing.bestPosition,
            result.position
          );
      }

      return accumulator;
    }, {});

  const topConstructors =
    Object.values(constructorResults)
      .sort(
        (a, b) =>
          a.bestPosition -
          b.bestPosition
      )
      .slice(0, 3);

  return (
    <main>
      <section>
        <h1>2025 Statistics</h1>

        <p>
          Explore Formula 1 season, race,
          driver and constructor analytics.
        </p>
      </section>

      {error && (
        <p
          style={{
            color: "red",
            marginTop: "20px",
          }}
        >
          {error}
        </p>
      )}

      <section className="stats-grid">
        <StatCard
          title="Races"
          value={races.length}
        />

        <StatCard
          title="Drivers"
          value={drivers.length}
        />

        <StatCard
          title="Constructors"
          value={
            CONSTRUCTOR_TEAM_NAMES.length
          }
        />

        <StatCard
          title="Season"
          value="2025"
        />
      </section>

      <section className="statistics-grid">
        <article className="statistics-card">
          <h2>Sample Race Statistics</h2>

          {raceStats ? (
            <dl className="statistics-list">
              <div>
                <dt>Race</dt>

                <dd>
                  {selectedRace?.name ??
                    "Belgian Grand Prix"}
                </dd>
              </div>

              <div>
                <dt>Total Laps</dt>

                <dd>
                  {raceStats.totalLaps}
                </dd>
              </div>

              <div>
                <dt>Fastest Lap</dt>

                <dd>
                  {raceStats.fastestLapTime}
                </dd>
              </div>

              <div>
                <dt>
                  Fastest Lap Driver
                </dt>

                <dd>
                  {
                    raceStats.fastestLapDriverName
                  }
                </dd>
              </div>

              <div>
                <dt>Pit Stops</dt>

                <dd>
                  {raceStats.pitStops}
                </dd>
              </div>

              <div>
                <dt>Overtakes</dt>

                <dd>
                  {raceStats.overtakes}
                </dd>
              </div>

              <div>
                <dt>Retirements</dt>

                <dd>
                  {raceStats.retirements}
                </dd>
              </div>
            </dl>
          ) : (
            <p>
              Race statistics are currently
              unavailable.
            </p>
          )}
        </article>

        <article className="statistics-card">
          <h2>Top Driver Finishes</h2>

          {topDrivers.length > 0 ? (
            <ol className="statistics-ranking">
              {topDrivers.map(
                (driver) => (
                  <li
                    key={driver.driverId}
                  >
                    <span>
                      {driver.position}.{" "}
                      {driver.driverName}
                    </span>

                    <strong>
                      {
                        driver.constructorName
                      }
                    </strong>
                  </li>
                )
              )}
            </ol>
          ) : (
            <p>
              Driver results are currently
              unavailable.
            </p>
          )}
        </article>

        <article className="statistics-card">
          <h2>
            Constructor Performance
          </h2>

          {topConstructors.length > 0 ? (
            <ol className="statistics-ranking">
              {topConstructors.map(
                (constructor, index) => (
                  <li
                    key={
                      constructor.constructorId
                    }
                  >
                    <span>
                      {index + 1}.{" "}
                      {
                        constructor.constructorName
                      }
                    </span>

                    <strong>
                      {constructor.finishes}{" "}
                      finish
                      {constructor.finishes !== 1
                        ? "es"
                        : ""}
                    </strong>
                  </li>
                )
              )}
            </ol>
          ) : (
            <p>
              Constructor results are
              currently unavailable.
            </p>
          )}
        </article>
      </section>

      <section className="statistics-chart-section">
        <h2>Performance Analytics</h2>

        <article className="statistics-card">
          <div className="placeholder-chart">
            <p>
              Additional performance charts
              will be displayed here as more
              statistics become available.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}

export default Statistics;