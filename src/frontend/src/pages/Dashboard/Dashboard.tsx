import StatCard from "../../components/StatCard";

import {
  recentSampleRace,
  sampleConstructorStandings,
  sampleDriverStandings,
  seasonSummary,
} from "../../data/f1Data";

function Dashboard() {
  return (
    <main>
      <section>
        <h1>
          {seasonSummary.season} Formula 1 Season
        </h1>

        <p>
          Season overview and performance analytics.
        </p>
      </section>

      <section className="stats-grid">
        <StatCard
          title="Races"
          value={String(
            seasonSummary.raceCount
          )}
        />

        <StatCard
          title="Drivers"
          value={String(
            seasonSummary.driverCount
          )}
        />

        <StatCard
          title="Constructors"
          value={String(
            seasonSummary.constructorCount
          )}
        />

        <StatCard
          title="Season"
          value={String(
            seasonSummary.season
          )}
        />
      </section>

      <section className="standings-grid">
        <article className="standings-card">
          <h2>
            Belgian GP Top Finishers
          </h2>

          <ol className="standings-list">
            {sampleDriverStandings.map(
              (driver) => (
                <li key={driver.driverId}>
                  <span>
                    {driver.position}.{" "}
                    {driver.name}
                  </span>

                  <strong>
                    {driver.team}
                  </strong>
                </li>
              )
            )}
          </ol>
        </article>

        <article className="standings-card">
          <h2>
            Belgian GP Constructors
          </h2>

          <ol className="standings-list">
            {sampleConstructorStandings.map(
              (constructor) => (
                <li
                  key={
                    constructor.constructorId
                  }
                >
                  <span>
                    {constructor.position}.{" "}
                    {constructor.name}
                  </span>

                  <strong>
                    {
                      constructor.finishes
                    }{" "}
                    top-10 finish
                    {constructor.finishes !== 1
                      ? "es"
                      : ""}
                  </strong>
                </li>
              )
            )}
          </ol>
        </article>
      </section>

      <section className="race-overview">
        <h2>Featured Race</h2>

        <article className="race-card">
          <header className="race-card-header">
            <div>
              <p>
                Round{" "}
                {recentSampleRace.round}
              </p>

              <h3>
                {recentSampleRace.name}
              </h3>
            </div>

            <span>
              {new Date(
                recentSampleRace.date
              ).getFullYear()}
            </span>
          </header>

          <div className="race-details">
            <div>
              <p>Winner</p>

              <strong>
                {recentSampleRace.winner}
              </strong>
            </div>

            <div>
              <p>Fastest Lap</p>

              <strong>
                {
                  recentSampleRace.fastestLapDriver
                }
              </strong>

              <p>
                {
                  recentSampleRace.fastestLapTime
                }
              </p>
            </div>

            <div>
              <p>Circuit</p>

              <strong>
                {
                  recentSampleRace.circuitName
                }
              </strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

export default Dashboard;