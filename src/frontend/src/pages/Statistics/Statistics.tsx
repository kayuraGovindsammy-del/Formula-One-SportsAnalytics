import StatCard from "../../components/StatCard";

import {
  belgianGpStatistics,
  sampleDriverStandings,
  sampleConstructorStandings,
  recentSampleRace,
  seasonSummary,
} from "../../data/f1Data";

function Statistics() {
  return (
    <main>
      <section>
        <h1>2025 Statistics</h1>
        <p>
          Explore Formula 1 season, race, driver and constructor analytics.
        </p>
      </section>

      <section className="stats-grid">
        <StatCard title="Races" value={seasonSummary.raceCount} />
        <StatCard title="Drivers" value={seasonSummary.driverCount} />
        <StatCard
          title="Constructors"
          value={seasonSummary.constructorCount}
        />
        <StatCard title="Season" value={seasonSummary.season} />
      </section>

      <section className="statistics-grid">
        <article className="statistics-card">
          <h2>Sample Race Statistics</h2>

          <dl className="statistics-list">
            <div>
              <dt>Race</dt>
              <dd>{recentSampleRace.name}</dd>
            </div>

            <div>
              <dt>Total Laps</dt>
              <dd>{belgianGpStatistics.totalLaps}</dd>
            </div>

            <div>
              <dt>Fastest Lap</dt>
              <dd>{belgianGpStatistics.fastestLapTime}</dd>
            </div>

            <div>
              <dt>Fastest Lap Driver</dt>
              <dd>{belgianGpStatistics.fastestLapDriverName}</dd>
            </div>

            <div>
              <dt>Pit Stops</dt>
              <dd>{belgianGpStatistics.pitStops}</dd>
            </div>

            <div>
              <dt>Overtakes</dt>
              <dd>{belgianGpStatistics.overtakes}</dd>
            </div>

            <div>
              <dt>Retirements</dt>
              <dd>{belgianGpStatistics.retirements}</dd>
            </div>
          </dl>
        </article>

        <article className="statistics-card">
          <h2>Top Driver Finishes</h2>

          <ol className="statistics-ranking">
            {sampleDriverStandings.map((driver) => (
              <li key={driver.driverId}>
                <span>
                  {driver.position}. {driver.name}
                </span>

                <strong>{driver.team}</strong>
              </li>
            ))}
          </ol>
        </article>

        <article className="statistics-card">
          <h2>Constructor Performance</h2>

          <ol className="statistics-ranking">
            {sampleConstructorStandings.map((constructor) => (
              <li key={constructor.constructorId}>
                <span>
                  {constructor.position}. {constructor.name}
                </span>

                <strong>
                  {constructor.finishes} finish
                  {constructor.finishes !== 1 ? "es" : ""}
                </strong>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className="statistics-chart-section">
        <h2>Performance Analytics</h2>

        <article className="statistics-card">
          <div className="placeholder-chart">
            <p>
              Additional performance charts will be displayed here as more
              statistics become available.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}

export default Statistics;