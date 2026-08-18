import { useParams } from "react-router-dom";
import StatCard from "../../components/StatCard";
import { races } from "../../data/f1Data";

function RaceDetails() {
  const { id } = useParams();

  const race = races.find((race) => race.round === Number(id));

  if (!race) {
    return (
      <main>
        <h1>Race not found</h1>
      </main>
    );
  }

  return (
    <main>
      <section className="race-detail-header">
        <p className="race-round">Round {race.round}</p>
        <h1>{race.name}</h1>
        <p>
          {race.circuitName}, {race.locality}, {race.country}
        </p>
        <time dateTime={race.date}>{race.date}</time>
      </section>

      <section className="stats-grid">
        <StatCard title="Format" value={race.hasSprint ? "Sprint Weekend" : "Standard Weekend"} />
        <StatCard title="Fastest Lap" value="--" />
        <StatCard title="DNFs" value="--" />
        <StatCard title="Pit Stops" value="--" />
      </section>

      <section className="race-details-grid">
        <article className="race-detail-card">
          <h2>Race Results</h2>

          <div className="race-results-placeholder">
            <p>Full finishing order will be displayed here.</p>
          </div>
        </article>

        <article className="race-detail-card">
          <h2>Race Overview</h2>

          <dl className="performance-list">
            <div>
              <dt>Total Laps</dt>
              <dd>--</dd>
            </div>

            <div>
              <dt>Fastest Lap</dt>
              <dd>--</dd>
            </div>

            <div>
              <dt>Overtakes</dt>
              <dd>--</dd>
            </div>

            <div>
              <dt>Retirements</dt>
              <dd>--</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="race-chart-section">
        <h2>Lap Time Analysis</h2>

        <article className="race-detail-card">
          <div className="placeholder-chart">
            <p>Lap time chart will be displayed here.</p>
          </div>
        </article>
      </section>
    </main>
  );
}

export default RaceDetails;
