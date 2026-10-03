import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Cell,
  ReferenceLine,
} from "recharts";

import { useEffect, useState, type CSSProperties } from "react";
import { getCircuitImage } from "../../data/circuitImages";
import "./Statistics.css";

import {
  fetchRaces,
  fetchRaceStatistics,
  fetchDrivers,
  fetchDriverStatistics,
  millisecondsToLapTime,
  type Race,
  type RaceStatistics,
  type Driver,
  type DriverStatistics,
} from "../../data/f1Data";


function getConstructorColor(constructorId?: string | null){
  const colours: Record<string, string> = {
    MCL: "#FF8700",
    FER: "#DC0000",
    MER: "#00D2BE",
    RBR: "#152B5B",
    AMR: "#006F62",
    ALP: "#2293D1",
    WIL: "#005AFF",
    RB: "#6692FF",
    SAU: "#52E252",
    HAA: "#B6BABD",
  };

  return colours[constructorId ?? ""] ?? "#e10600";
}


function Statistics() {
  const [races, setRaces] = useState<Race[]>([]);
  const [raceStats, setRaceStats] =
    useState<RaceStatistics | null>(null);
  const [selectedRaceId, setSelectedRaceId] =
  useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [drivers, setDrivers] = useState<Driver[]>([]);

const [driverOneId, setDriverOneId] =
  useState("");

const [driverTwoId, setDriverTwoId] =
  useState("");

const [driverOneStats, setDriverOneStats] =
  useState<DriverStatistics | null>(null);

const [driverTwoStats, setDriverTwoStats] =
  useState<DriverStatistics | null>(null);

const [comparisonLoading, setComparisonLoading] =
  useState(false);

const [allDriverStats, setAllDriverStats] =
  useState<DriverStatistics[]>([]);

  useEffect(() => {
    const loadStatistics = async () => {
      try {
        setLoading(true);
        setError("");

        const [raceData, driverData] =
  await Promise.all([
    fetchRaces(),
    fetchDrivers(),
  ]);

setRaces(raceData);
setDrivers(driverData);

        
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

  useEffect(() => {
  if (drivers.length === 0) {
    return;
  }

  const loadDriverStatistics = async () => {
    try {
      const results =
        await Promise.allSettled(
          drivers.map((driver) =>
            fetchDriverStatistics(
              driver.driverId
            )
          )
        );

      const availableStats =
        results
          .filter(
            (
              result
            ): result is PromiseFulfilledResult<DriverStatistics> =>
              result.status === "fulfilled"
          )
          .map(
            (result) => result.value
          );

      setAllDriverStats(
        availableStats
      );
    } catch (err) {
      console.error(
        "Failed to load driver statistics:",
        err
      );
    }
  };

  void loadDriverStatistics();
}, [drivers]);

  const handleRaceChange = async (
  raceId: string
) => {
  setSelectedRaceId(raceId);
  setRaceStats(null);

  try {
    setError("");

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
  }
};

const handleCompareDrivers = async () => {
  if (!driverOneId || !driverTwoId) {
    return;
  }

  if (driverOneId === driverTwoId) {
    return;
  }

  try {
    setComparisonLoading(true);

    const [statsOne, statsTwo] =
      await Promise.all([
        fetchDriverStatistics(driverOneId),
        fetchDriverStatistics(driverTwoId),
      ]);

    setDriverOneStats(statsOne);
    setDriverTwoStats(statsTwo);
  } catch (err) {
    console.error(
      "Failed to load driver comparison:",
      err
    );

    setDriverOneStats(null);
    setDriverTwoStats(null);
  } finally {
    setComparisonLoading(false);
  }
};

const driverOne = drivers.find(
  (driver) => driver.driverId === driverOneId
);

const driverTwo = drivers.find(
  (driver) => driver.driverId === driverTwoId
);


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

  const topDrivers =
    classification.slice(0, 3);
  
  const gapToWinnerData = classification
  .slice(0, 10)
  .map((driver) => ({
    driver: driver.driverName,
    position: driver.position,
    gapSeconds:
      driver.position === 1
        ? 0
        : driver.gapToWinnerMs !== null
          ? Number((driver.gapToWinnerMs / 1000).toFixed(3))
          : null,
      
       color: getConstructorColor(
      driver.constructorId
    ),
  }))
  .filter(
    (driver) => driver.gapSeconds !== null
  );

  const pitStopPerformanceData = classification
  .slice(0, 10)
  .map((driver) => ({
    driver: driver.driverName,
    position: driver.position,
    pitStops: driver.pitStops,
    color: getConstructorColor(driver.constructorId),
  }));

  const constructorResults =
    classification.slice(0,10).reduce<
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

const getHigherBetterClass = (
  first: number | null,
  second: number | null,
  side: "first" | "second"
) => {
  if (first === null || second === null) {
    return "";
  }

  if (first === second) {
    return "comparison-tie";
  }

  const firstIsBetter = first > second;

  if (side === "first") {
    return firstIsBetter
      ? "comparison-better"
      : "comparison-worse";
  }

  return firstIsBetter
    ? "comparison-worse"
    : "comparison-better";
};

const getLowerBetterClass = (
  first: number | null,
  second: number | null,
  side: "first" | "second"
) => {
  if (first === null || second === null) {
    return "";
  }

  if (first === second) {
    return "comparison-tie";
  }

  const firstIsBetter = first < second;

  if (side === "first") {
    return firstIsBetter
      ? "comparison-better"
      : "comparison-worse";
  }

  return firstIsBetter
    ? "comparison-worse"
    : "comparison-better";
};

const positionsGainedLostData =
  allDriverStats
    .filter(
      (stats) =>
        stats.positionsGainedLostAvg !== null
    )
    .map((stats) => {
      const driver = drivers.find(
        (driver) =>
          driver.driverId === stats.driverId
      );

      return {
        driver:
          driver?.name ?? stats.driverId,

        value:
          stats.positionsGainedLostAvg ?? 0,

        constructorId:
          driver?.constructorId ?? null,

        color:
          getConstructorColor(
            driver?.constructorId
          ),
      };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <main>
      <section>
        <h1>2025 Statistics</h1>

        <p>
          Explore Formula 1 season, race,
          driver and constructor analytics.
        </p>
      </section>

<section className="driver-comparison-section">
  <div className="statistics-section-heading">
    <div>
      <p className="statistics-section-label">
        Season Comparison
      </p>

      <h2>Driver Head-to-Head</h2>

      <p>
        Compare two drivers across their 2025 season statistics.
      </p>
    </div>
  </div>

  <article className="statistics-card driver-comparison-card">
    <div className="driver-comparison-controls">
      <div>
        <label htmlFor="driver-one">
          Driver One
        </label>

        <select
          id="driver-one"
          value={driverOneId}
          onChange={(event) => {
            setDriverOneId(event.target.value);
            setDriverOneStats(null);
          }}
        >
          <option value="">
            Select driver
          </option>

          {drivers.map((driver) => (
            <option
              key={driver.driverId}
              value={driver.driverId}
              disabled={
                driver.driverId === driverTwoId
              }
            >
              {driver.name}
            </option>
          ))}
        </select>
      </div>

      <span className="driver-comparison-vs">
        VS
      </span>

      <div>
        <label htmlFor="driver-two">
          Driver Two
        </label>

        <select
          id="driver-two"
          value={driverTwoId}
          onChange={(event) => {
            setDriverTwoId(event.target.value);
            setDriverTwoStats(null);
          }}
        >
          <option value="">
            Select driver
          </option>

          {drivers.map((driver) => (
            <option
              key={driver.driverId}
              value={driver.driverId}
              disabled={
                driver.driverId === driverOneId
              }
            >
              {driver.name}
            </option>
          ))}
        </select>
      </div>
    </div>

    <button
      type="button"
      className="driver-comparison-button"
      onClick={() => void handleCompareDrivers()}
      disabled={
        !driverOneId ||
        !driverTwoId ||
        driverOneId === driverTwoId ||
        comparisonLoading
      }
    >
      {comparisonLoading
        ? "Comparing..."
        : "Compare Drivers"}
    </button>

    {driverOneStats &&
      driverTwoStats &&
      driverOne &&
      driverTwo && (
        <div className="driver-comparison-results">

          {/* DRIVER HEADERS */}

          <div
            className="driver-comparison-header driver-one"
            style={
              {
                "--driver-color":
                  getConstructorColor(
                    driverOne.constructorId
                  ),
              } as CSSProperties
            }
          >
            <strong>{driverOne.name}</strong>
            <span>{driverOne.team}</span>
          </div>

          <div className="driver-comparison-label">
            2025 Season
          </div>

          <div
            className="driver-comparison-header driver-two"
            style={
              {
                "--driver-color":
                  getConstructorColor(
                    driverTwo.constructorId
                  ),
              } as CSSProperties
            }
          >
            <strong>{driverTwo.name}</strong>
            <span>{driverTwo.team}</span>
          </div>


          {/* WINS */}

          <strong
            className={getHigherBetterClass(
              driverOneStats.wins,
              driverTwoStats.wins,
              "first"
            )}
          >
            {driverOneStats.wins}
          </strong>

          <span>Wins</span>

          <strong
            className={getHigherBetterClass(
              driverOneStats.wins,
              driverTwoStats.wins,
              "second"
            )}
          >
            {driverTwoStats.wins}
          </strong>


          {/* PODIUMS */}

          <strong
            className={getHigherBetterClass(
              driverOneStats.podiums,
              driverTwoStats.podiums,
              "first"
            )}
          >
            {driverOneStats.podiums}
          </strong>

          <span>Podiums</span>

          <strong
            className={getHigherBetterClass(
              driverOneStats.podiums,
              driverTwoStats.podiums,
              "second"
            )}
          >
            {driverTwoStats.podiums}
          </strong>


          {/* POINTS */}

          <strong
            className={getHigherBetterClass(
              driverOneStats.points,
              driverTwoStats.points,
              "first"
            )}
          >
            {driverOneStats.points ?? "—"}
          </strong>

          <span>Points</span>

          <strong
            className={getHigherBetterClass(
              driverOneStats.points,
              driverTwoStats.points,
              "second"
            )}
          >
            {driverTwoStats.points ?? "—"}
          </strong>


          {/* AVERAGE FINISH */}

          <strong
            className={getLowerBetterClass(
              driverOneStats.averageFinishPosition,
              driverTwoStats.averageFinishPosition,
              "first"
            )}
          >
            {driverOneStats.averageFinishPosition !== null
              ? driverOneStats.averageFinishPosition.toFixed(
                  1
                )
              : "—"}
          </strong>

          <span>Avg Finish</span>

          <strong
            className={getLowerBetterClass(
              driverOneStats.averageFinishPosition,
              driverTwoStats.averageFinishPosition,
              "second"
            )}
          >
            {driverTwoStats.averageFinishPosition !== null
              ? driverTwoStats.averageFinishPosition.toFixed(
                  1
                )
              : "—"}
          </strong>


          {/* AVERAGE RACE PACE */}

          <strong
            className={getLowerBetterClass(
              driverOneStats.averageRacePaceMs,
              driverTwoStats.averageRacePaceMs,
              "first"
            )}
          >
            {driverOneStats.averageRacePaceMs !== null
              ? millisecondsToLapTime(
                  Math.round(
                    driverOneStats.averageRacePaceMs
                  )
                )
              : "—"}
          </strong>

          <span>Avg Race Pace</span>

          <strong
            className={getLowerBetterClass(
              driverOneStats.averageRacePaceMs,
              driverTwoStats.averageRacePaceMs,
              "second"
            )}
          >
            {driverTwoStats.averageRacePaceMs !== null
              ? millisecondsToLapTime(
                  Math.round(
                    driverTwoStats.averageRacePaceMs
                  )
                )
              : "—"}
          </strong>


          {/* POSITIONS GAINED / LOST */}

          <strong
            className={getHigherBetterClass(
              driverOneStats.positionsGainedLostAvg,
              driverTwoStats.positionsGainedLostAvg,
              "first"
            )}
          >
            {driverOneStats.positionsGainedLostAvg !== null
              ? `${
                  driverOneStats.positionsGainedLostAvg >
                  0
                    ? "+"
                    : ""
                }${driverOneStats.positionsGainedLostAvg.toFixed(
                  1
                )}`
              : "—"}
          </strong>

          <span>Avg Positions Gained</span>

          <strong
            className={getHigherBetterClass(
              driverOneStats.positionsGainedLostAvg,
              driverTwoStats.positionsGainedLostAvg,
              "second"
            )}
          >
            {driverTwoStats.positionsGainedLostAvg !== null
              ? `${
                  driverTwoStats.positionsGainedLostAvg >
                  0
                    ? "+"
                    : ""
                }${driverTwoStats.positionsGainedLostAvg.toFixed(
                  1
                )}`
              : "—"}
          </strong>


          {/* FASTEST LAPS */}

          <strong
            className={getHigherBetterClass(
              driverOneStats.fastestLaps,
              driverTwoStats.fastestLaps,
              "first"
            )}
          >
            {driverOneStats.fastestLaps}
          </strong>

          <span>Fastest Laps</span>

          <strong
            className={getHigherBetterClass(
              driverOneStats.fastestLaps,
              driverTwoStats.fastestLaps,
              "second"
            )}
          >
            {driverTwoStats.fastestLaps}
          </strong>


          {/* DNFs */}

          <strong
            className={getLowerBetterClass(
              driverOneStats.dnfCount,
              driverTwoStats.dnfCount,
              "first"
            )}
          >
            {driverOneStats.dnfCount}
          </strong>

          <span>DNFs</span>

          <strong
            className={getLowerBetterClass(
              driverOneStats.dnfCount,
              driverTwoStats.dnfCount,
              "second"
            )}
          >
            {driverTwoStats.dnfCount}
          </strong>
        </div>
      )}
  </article>
</section>

<section className="positions-analysis-section">
  <div className="statistics-section-heading">
    <div>
      <p className="statistics-section-label">
        Season Performance
      </p>

      <h2>Positions Gained / Lost</h2>

      <p>
        Average positions gained or lost by each
        driver across the 2025 season.
      </p>
    </div>
  </div>

  <article className="statistics-card statistics-chart-card">
    {positionsGainedLostData.length > 0 ? (
      <div className="statistics-chart">
        <ResponsiveContainer
          width="100%"
          height={520}
        >
          <BarChart
            data={positionsGainedLostData}
            layout="vertical"
            margin={{
              top: 10,
              right: 40,
              left: 45,
              bottom: 20,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.08)"
              horizontal={false}
            />

            <XAxis
              type="number"
              stroke="#888"
              tick={{
                fill: "#b5b5b5",
                fontSize: 12,
              }}
              axisLine={{
                stroke:
                  "rgba(255,255,255,0.15)",
              }}
              tickLine={false}
            />

            <YAxis
              type="category"
              dataKey="driver"
              width={125}
              stroke="#090707"
              tick={{
                fill: "#f3e4e4",
                fontSize: 12,
              }}
              axisLine={false}
              tickLine={false}
            />

            <ReferenceLine
              x={0}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={2}
            />

            <Tooltip
              cursor={{
                fill:
                  "rgba(83, 34, 34, 0.01)",
              }}
              formatter={(value) => {
                const numericValue =
                  Number(value);

                return [
                  `${
                    numericValue > 0
                      ? "+"
                      : ""
                  }${numericValue.toFixed(1)}`,
                  "Avg Positions",
                ];
              }}
              contentStyle={{
                background: "#e3cfcf",
                border:
                  "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px",
                color: "black",
              }}
              labelStyle={{
                color: "black",
                fontWeight: 700,
              }}
            />

            <Bar
              dataKey="value"
              name="Average Positions"
              radius={[5, 5, 5, 5]}
              maxBarSize={24}
            >
              {positionsGainedLostData.map(
                (driver) => (
                  <Cell
                    key={driver.driver}
                    fill={driver.color}
                  />
                )
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <p className="statistics-empty">
        Position gain/loss data is currently
        unavailable.
      </p>
    )}
  </article>
</section>

<section className="statistics-race-heading">

  <h1>Select a Race</h1>

  <p>
    Choose a Grand Prix to explore its race results,
    podium, constructor performance and race analytics.
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
    
    <section className="statistics-overview-grid">
  <article className="statistics-overview-card">
    <span>Fastest Lap</span>
    <strong>{raceStats?.fastestLapTime ?? "—"}</strong>
    <small>{raceStats?.fastestLapDriverName ?? "Not available"}</small>
  </article>

  <article className="statistics-overview-card">
    <span>Overtakes</span>
    <strong>{raceStats?.overtakes ?? 0}</strong>
    <small>Recorded during race</small>
  </article>

  <article className="statistics-overview-card">
    <span>Pit Stops</span>
    <strong>{raceStats?.pitStops ?? 0}</strong>
    <small>Total pit activity</small>
  </article>

  <article className="statistics-overview-card">
    <span>Retirements</span>
    <strong>{raceStats?.retirements ?? 0}</strong>
    <small>Drivers retired</small>
  </article>

  <article className="statistics-overview-card">
    <span>Total Laps</span>
    <strong>{raceStats?.totalLaps ?? 0}</strong>
    <small>Race distance</small>
  </article>
</section>

<section className="statistics-podium-section">
  <div className="statistics-section-heading">
    <div>
      <p className="statistics-section-label">
        Race Result
      </p>

      <h2>Podium</h2>
    </div>
  </div>

  {topDrivers.length >= 3 ? (
    <div className="statistics-podium">
      <article
        className="podium-driver podium-second"
        style={
          {
            "--podium-color": getConstructorColor(
              topDrivers[1].constructorId
            ),
          } as CSSProperties
        }
      >
        <span className="podium-position"></span>

        <strong>
          {topDrivers[1].driverName}
        </strong>

        <small>
          {topDrivers[1].constructorName}
        </small>

        <div className="podium-block">
          2
        </div>
      </article>

      <article
        className="podium-driver podium-first"
        style={
          {
            "--podium-color": getConstructorColor(
              topDrivers[0].constructorId
            ),
          } as CSSProperties
        }
      >
        <span className="podium-position"></span>

        <strong>
          {topDrivers[0].driverName}
        </strong>

        <small>
          {topDrivers[0].constructorName}
        </small>

        <div className="podium-block">
          1
        </div>
      </article>

      <article
        className="podium-driver podium-third"
        style={
          {
            "--podium-color": getConstructorColor(
              topDrivers[2].constructorId
            ),
          } as CSSProperties
        }
      >
        <span className="podium-position"></span>

        <strong>
          {topDrivers[2].driverName}
        </strong>

        <small>
          {topDrivers[2].constructorName}
        </small>

        <div className="podium-block">
          3
        </div>
      </article>
    </div>
  ) : (
    <p className="statistics-empty">
      Podium data is currently unavailable.
    </p>
  )}
</section>

<section className="statistics-classification-section">
  <div className="statistics-section-heading">
    <div>
      <p className="statistics-section-label">
        Top 10 finish
      </p>

      <h2>Race Classification</h2>
    </div>
  </div>

  {classification.length > 0 ? (
    <div className="statistics-classification">
      {classification.slice(0,10).map((driver) => (
        <article
          key={driver.driverId}
          className="statistics-classification-row"
        >
          <span className="classification-position">
            P{driver.position}
          </span>

          <div className="classification-driver">
            <strong>{driver.driverName}</strong>
            <small>{driver.constructorName}</small>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <p className="statistics-empty">
      Classification data is currently unavailable.
    </p>
  )}
</section>

      <section className="statistics-grid">
        {circuitImage && (
  <article className="statistics-card statistics-circuit-card">
    <div className="statistics-circuit-heading">
      <div>
        <p className="statistics-section-label">
          Circuit
        </p>

        <h2>
          {selectedRace?.name ?? "Race Circuit"}
        </h2>
      </div>
    </div>

    <div className="statistics-circuit-container">
      <img
        src={circuitImage}
        alt={`${selectedRace?.name ?? "Race"} circuit layout`}
        className="statistics-circuit-image"
      />
    </div>
  </article>
)}


<article className="statistics-card constructor-performance-card">
  <div className="statistics-section-heading">
    <div>
      <p className="statistics-section-label">
        Team Analysis
      </p>

      <h2>Constructor Performance</h2>
    </div>
  </div>

  {topConstructors.length > 0 ? (
    <div className="constructor-performance-grid">
      {topConstructors.map((constructor) => (
        <article
          key={constructor.constructorId}
          className="constructor-performance-item"
          style={
          {
             "--constructor-color": getConstructorColor(
              constructor.constructorId
              ),
          } as CSSProperties
        }
        >
          <span className="constructor-performance-name">
            {constructor.constructorName}
          </span>

          <div className="constructor-performance-stats">
            <div>
              <span>Best Finish</span>
              <strong>P{constructor.bestPosition}</strong>
            </div>

            <div>
              <span>Classified Cars</span>
              <strong>{constructor.finishes}</strong>
            </div>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <p className="statistics-empty">
      Constructor results are currently unavailable.
    </p>
  )}
</article>

      </section>
      
<section className="statistics-chart-section">
  <div className="statistics-section-heading">
    <div>
      <p className="statistics-section-label">
        Race Pace
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
        <h3>Gap to Winner</h3>

        <p>
          Time gap between the race winner and each
          driver in the Top 10.
        </p>
      </div>
    </div>

    {gapToWinnerData.length > 0 ? (
      <div className="statistics-chart">
        <ResponsiveContainer
          width="100%"
          height={430}
        >
          <BarChart
            data={gapToWinnerData}
            layout="vertical"
            margin={{
              top: 10,
              right: 30,
              left: 35,
              bottom: 10,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.08)"
              horizontal={false}
            />

            <XAxis
              type="number"
              stroke="#888"
              tick={{
                fill: "#b5b5b5",
                fontSize: 12,
              }}
              axisLine={{
                stroke: "rgba(255,255,255,0.15)",
              }}
              tickLine={false}
              label={{
                value: "Gap to winner (seconds)",
                position: "insideBottom",
                offset: -5,
                fill: "#999",
              }}
            />

            <YAxis
              type="category"
              dataKey="driver"
              width={115}
              stroke="#888"
              tick={{
                fill: "#b5b5b5",
                fontSize: 12,
              }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              cursor={{
                fill: "rgba(255,255,255,0.04)",
              }}
              formatter={(value) => [
                `${Number(value).toFixed(3)}s`,
                "Gap",
              ]}
              contentStyle={{
                background: "#fff6f6",
                border:
                  "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px",
                color: "white",
              }}
              labelStyle={{
                color: "black",
                fontWeight: 700,
              }}
            />

            <Bar
  dataKey="gapSeconds"
  name="Gap"
  radius={[0, 6, 6, 0]}
  maxBarSize={28}
>
  {gapToWinnerData.map((driver) => (
    <Cell
      key={driver.driver}
      fill={driver.color}
    />
  ))}
</Bar>
        
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <p className="statistics-empty">
        Gap data is currently unavailable for this race.
      </p>
    )}
  </article>

<article className="statistics-card statistics-chart-card">
  <div className="statistics-chart-header">
    <div>
      <h3>Pit Stops vs Finishing Position</h3>

      <p>
        Compare pit-stop strategy with each Top 10
        driver's final finishing position.
      </p>
    </div>
  </div>

  {pitStopPerformanceData.length > 0 ? (
    <div className="statistics-chart">
      <ResponsiveContainer
        width="100%"
        height={430}
      >
        <ComposedChart
          data={pitStopPerformanceData}
          margin={{
            top: 20,
            right: 35,
            left: 10,
            bottom: 45,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.08)"
            vertical={false}
          />

          <XAxis
            dataKey="driver"
            stroke="#888"
            tick={{
              fill: "#b5b5b5",
              fontSize: 11,
            }}
            axisLine={{
              stroke: "rgba(255,255,255,0.15)",
            }}
            tickLine={false}
            angle={-25}
            textAnchor="end"
            interval={0}
            height={75}
          />

          {/* LEFT AXIS - PIT STOPS */}
          <YAxis
            yAxisId="pitStops"
            orientation="left"
            allowDecimals={false}
            domain={[0, "auto"]}
            stroke="#e10600"
            tick={{
              fill: "#b5b5b5",
              fontSize: 12,
            }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Pit Stops",
              angle: -90,
              position: "insideLeft",
              fill: "#999",
            }}
          />

          {/* RIGHT AXIS - FINISHING POSITION */}
          <YAxis
            yAxisId="position"
            orientation="right"
            domain={[10, 1]}
            ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
            allowDecimals={false}
            stroke="#aaa"
            tickFormatter={(value) => `P${value}`}
            tick={{
              fill: "#b5b5b5",
              fontSize: 12,
            }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            cursor={{
              fill: "rgba(255,255,255,0.04)",
            }}
            formatter={(value, name) => {
              if (name === "Finishing Position") {
                return [`P${value}`, name];
              }

              return [value, name];
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

          {/* TEAM-COLOURED PIT STOP BARS */}
          <Bar
            yAxisId="pitStops"
            dataKey="pitStops"
            name="Pit Stops"
            radius={[6, 6, 0, 0]}
            maxBarSize={40}
          >
            {pitStopPerformanceData.map((driver) => (
              <Cell
                key={driver.driver}
                fill={driver.color}
              />
            ))}
          </Bar>

          {/* FINISHING POSITION LINE */}
          <Line
            yAxisId="position"
            type="monotone"
            dataKey="position"
            name="Finishing Position"
            stroke="#ffffff"
            strokeWidth={3}
            dot={{
              r: 5,
              fill: "#ffffff",
              strokeWidth: 0,
            }}
            activeDot={{
              r: 7,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <p className="statistics-empty">
      Pit stop data is currently unavailable.
    </p>
  )}
</article>
</section>
      
    </main>
  );
}

export default Statistics;