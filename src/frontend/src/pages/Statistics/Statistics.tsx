import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useEffect, useState } from "react";
import { getCircuitImage } from "../../data/circuitImages";

import {
  fetchRaces,
  fetchRaceStatistics,
  type Race,
  type RaceStatistics,
} from "../../data/f1Data";

function Statistics() {
  const [races, setRaces] = useState<Race[]>([]);
  const [raceStats, setRaceStats] =
    useState<RaceStatistics | null>(null);
  const [selectedRaceId, setSelectedRaceId] =
  useState("");
  const [raceStatsLoading, setRaceStatsLoading] =
  useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStatistics = async () => {
      try {
        setLoading(true);
        setError("");

        const raceData = await fetchRaces();

        setRaces(raceData);

        
        const defaultRace = raceData[0];

if (defaultRace) {
  setSelectedRaceId(
    defaultRace.grandPrixId
  );

  try {
    const statistics =
      await fetchRaceStatistics(
        defaultRace.grandPrixId
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

  const handleRaceChange = async (
  raceId: string
) => {
  setSelectedRaceId(raceId);
  setRaceStats(null);

  try {
    setError("");
    setRaceStatsLoading(true);

    const statistics =
      await fetchRaceStatistics(raceId);

    setRaceStats(statistics);
  } catch (err) {
    console.error(
      "Failed to load race statistics:",
      err
    );

    setRaceStats(null);

    setError(
      "Statistics are not available for this race."
    );
  } finally {
    setRaceStatsLoading(false);
  }
};

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
      race.grandPrixId === selectedRaceId
  ) ?? null;
 
 const circuitImage = selectedRace
  ? getCircuitImage(selectedRace.country)
  : ""; 

  const classification =
    raceStats?.classification ?? [];
  
    const raceActivityData = raceStats
  ? [
      {
        name: "Overtakes",
        value: raceStats.overtakes,
      },
      {
        name: "Pit Stops",
        value: raceStats.pitStops,
      },
      {
        name: "Retirements",
        value: raceStats.retirements,
      },
    ]
  : [];


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
      const constructorKey =
        result.constructorId ?? "unknown";
      const existing =
        accumulator[constructorKey];

      if (!existing) {
        accumulator[constructorKey] = {
          constructorId:
            result.constructorId ?? "unknown",

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

      <section className="statistics-controls">
  <label htmlFor="statistics-race">
    Select Race
  </label>

  <select
    id="statistics-race"
    value={selectedRaceId}
    onChange={(event) =>
      void handleRaceChange(
        event.target.value
      )
    }
  >
    {races.map((race) => (
      <option
        key={race.grandPrixId}
        value={race.grandPrixId}
      >
        Round {race.round} — {race.name}
      </option>
    ))}
  </select>
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


      <section className="statistics-grid">
        <article className="statistics-card statistics-race-card">
  <div className="statistics-race-info">
    <h2>Race Statistics</h2>

    {raceStatsLoading ? (
      <p>Loading race statistics...</p>
    ) : raceStats ? (
      <dl className="statistics-list">
        <div>
          <dt>Race</dt>
          <dd>
            {selectedRace?.name ?? "Not available"}
          </dd>
        </div>

        <div>
          <dt>Total Laps</dt>
          <dd>{raceStats.totalLaps}</dd>
        </div>

        <div>
          <dt>Fastest Lap</dt>
          <dd>{raceStats.fastestLapTime}</dd>
        </div>

        <div>
          <dt>Fastest Lap Driver</dt>
          <dd>
            {raceStats.fastestLapDriverName}
          </dd>
        </div>

        <div>
          <dt>Pit Stops</dt>
          <dd>{raceStats.pitStops}</dd>
        </div>

        <div>
          <dt>Overtakes</dt>
          <dd>{raceStats.overtakes}</dd>
        </div>

        <div>
          <dt>Retirements</dt>
          <dd>{raceStats.retirements}</dd>
        </div>
      </dl>
    ) : (
      <p>
        Race statistics are currently unavailable.
      </p>
    )}
  </div>

  {circuitImage && (
    <div className="statistics-circuit-container">
      <img
        src={circuitImage}
        alt={`${selectedRace?.name ?? "Race"} circuit layout`}
        className="statistics-circuit-image"
      />
    </div>
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
  <div className="statistics-section-heading">
    <div>
      <p className="statistics-section-label">
        Race Analysis
      </p>

      <h2>Performance Analytics</h2>
    </div>

    {selectedRace && (
      <span className="statistics-selected-race">
        {selectedRace.name}
      </span>
    )}
  </div>

  <article className="statistics-card statistics-chart-card">
    <div className="statistics-chart-header">
      <div>
        <h3>Race Activity</h3>

        <p>
          Overtakes, pit stops and retirements recorded
          during the selected race.
        </p>
      </div>
    </div>

    {raceStats ? (
      <div className="statistics-chart">
        <ResponsiveContainer
          width="100%"
          height={350}
        >
          <BarChart
            data={raceActivityData}
            margin={{
              top: 20,
              right: 20,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255, 255, 255, 0.08)"
              vertical={false}
            />

            <XAxis
              dataKey="name"
              stroke="#888"
              tick={{
                fill: "#b5b5b5",
                fontSize: 13,
              }}
              axisLine={{
                stroke: "rgba(255,255,255,0.15)",
              }}
              tickLine={false}
            />

            <YAxis
              allowDecimals={false}
              stroke="#888"
              tick={{
                fill: "#b5b5b5",
                fontSize: 13,
              }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              cursor={{
                fill: "rgba(255,255,255,0.04)",
              }}
              contentStyle={{
                background: "#181818",
                border:
                  "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px",
                color: "white",
              }}
              labelStyle={{
                color: "white",
                fontWeight: 700,
              }}
            />

            <Bar
              dataKey="value"
              name="Events"
              fill="#e10600"
              radius={[6, 6, 0, 0]}
              maxBarSize={100}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <p className="statistics-empty">
        Race activity data is currently unavailable.
      </p>
    )}
  </article>
</section>
      
    </main>
  );
}

export default Statistics;