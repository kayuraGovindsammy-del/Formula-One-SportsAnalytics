import { useParams } from "react-router-dom";

import StatCard from "../../components/StatCard";

import {
  belgianGpStatistics,
  millisecondsToGap,
  races,
} from "../../data/f1Data";

function RaceDetails() {
  const { id } = useParams();

  const race = races.find(
    (race) => race.round === Number(id)
  );

  if (!race) {
    return (
      <main>
        <h1>Race not found</h1>
      </main>
    );
  }

  const hasStatistics =
    race.round === belgianGpStatistics.round;

  return (
    <main>
      <section className="race-detail-header">
        <p className="race-round">
          Round {race.round}
        </p>

        <h1>{race.name}</h1>

        <p>
          {race.circuitName}, {race.locality},{" "}
          {race.country}
        </p>

        <time dateTime={race.date}>
          {race.date}
        </time>
      </section>

      {hasStatistics ? (
        <>
          <section className="stats-grid">
            <StatCard
              title="Format"
              value={
                race.hasSprint
                  ? "Sprint Weekend"
                  : "Standard Weekend"
              }
            />

            <StatCard
              title="Fastest Lap"
              value={
                belgianGpStatistics.fastestLapTime
              }
            />

            <StatCard
              title="DNFs"
              value={String(
                belgianGpStatistics.dnfs
              )}
            />

            <StatCard
              title="Pit Stops"
              value={String(
                belgianGpStatistics.pitStops
              )}
            />
          </section>

          <section className="race-details-grid">
            <article className="race-detail-card">
              <h2>Race Results</h2>

              <div className="race-results">
                {belgianGpStatistics.classification.map(
                  (result) => (
                    <div
                      key={result.driverId}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "50px 1fr 1fr 100px",
                        gap: "15px",
                        padding: "12px 0",
                        borderBottom:
                          "1px solid #333",
                      }}
                    >
                      <strong>
                        {result.position}
                      </strong>

                      <span>
                        {result.driverName}
                      </span>

                      <span>
                        {
                          result.constructorName
                        }
                      </span>

                      <span>
                        {millisecondsToGap(
                          result.gapToWinnerMs
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>
            </article>

            <article className="race-detail-card">
              <h2>Race Overview</h2>

              <dl className="performance-list">
                <div>
                  <dt>Total Laps</dt>

                  <dd>
                    {
                      belgianGpStatistics.totalLaps
                    }
                  </dd>
                </div>

                <div>
                  <dt>Fastest Lap</dt>

                  <dd>
                    {
                      belgianGpStatistics.fastestLapDriverName
                    }
                    {" — "}
                    {
                      belgianGpStatistics.fastestLapTime
                    }
                  </dd>
                </div>

                <div>
                  <dt>Fastest Lap Number</dt>

                  <dd>
                    Lap{" "}
                    {
                      belgianGpStatistics.fastestLapNumber
                    }
                  </dd>
                </div>

                <div>
                  <dt>Overtakes Recorded</dt>

                  <dd>
                    {
                      belgianGpStatistics.overtakes
                    }
                  </dd>
                </div>

                <div>
                  <dt>Pit Stops Recorded</dt>

                  <dd>
                    {
                      belgianGpStatistics.pitStops
                    }
                  </dd>
                </div>

                <div>
                  <dt>Retirements Recorded</dt>

                  <dd>
                    {
                      belgianGpStatistics.retirements
                    }
                  </dd>
                </div>
              </dl>
            </article>
          </section>

          <section className="race-chart-section">
            <h2>Event Data Summary</h2>

            <article className="race-detail-card">
              <p>
                The available Belgian Grand Prix
                statistics are derived from the
                project's event sample data.
              </p>

              <p>
                Session ID:{" "}
                <strong>
                  {
                    belgianGpStatistics.sessionId
                  }
                </strong>
              </p>
            </article>
          </section>
        </>
      ) : (
        <>
          <section className="stats-grid">
            <StatCard
              title="Format"
              value={
                race.hasSprint
                  ? "Sprint Weekend"
                  : "Standard Weekend"
              }
            />

            <StatCard
              title="Fastest Lap"
              value="Not available"
            />

            <StatCard
              title="DNFs"
              value="Not available"
            />

            <StatCard
              title="Pit Stops"
              value="Not available"
            />
          </section>

          <section className="race-details-grid">
            <article className="race-detail-card">
              <h2>Race Results</h2>

              <p>
                Detailed event data is not currently
                included in the project sample dataset
                for this race.
              </p>
            </article>

            <article className="race-detail-card">
              <h2>Race Overview</h2>

              <p>
                Race statistics will be available when
                event data for this race is added.
              </p>
            </article>
          </section>
        </>
      )}
    </main>
  );
}

export default RaceDetails;