import { useParams } from "react-router-dom";
import StatCard from "../../components/StatCard";
import { drivers } from "../../data/drivers";

function DriverDetails() {
  const { id } = useParams();

  const driver = drivers.find((driver) => driver.id === Number(id));

  if (!driver) {
    return (
      <main>
        <h1>Driver not found</h1>
      </main>
    );
  }

  return (
    <main>
      <section className="driver-profile-header">
        <div>
          <p className="driver-profile-number">#{driver.number}</p>
          <h1>{driver.name}</h1>
          <p>{driver.team}</p>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard title="Points" value={driver.points} />
        <StatCard title="Wins" value={driver.wins} />
        <StatCard title="Podiums" value={driver.podiums} />
        <StatCard title="DNFs" value="--" />
      </section>

      <section className="driver-details-grid">
        <article className="driver-detail-card">
          <h2>Race Performance</h2>

          <div className="placeholder-chart">
            <p>Race pace chart will be displayed here.</p>
          </div>
        </article>

        <article className="driver-detail-card">
          <h2>2025 Performance</h2>

          <dl className="performance-list">
            <div>
              <dt>Average Finish</dt>
              <dd>--</dd>
            </div>

            <div>
              <dt>Fastest Laps</dt>
              <dd>--</dd>
            </div>

            <div>
              <dt>Positions Gained</dt>
              <dd>--</dd>
            </div>

            <div>
              <dt>Consistency</dt>
              <dd>--</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="driver-results-section">
        <h2>Recent Race Results</h2>

        <article className="driver-detail-card">
          <p>Race result data will be displayed here.</p>
        </article>
      </section>
    </main>
  );
}

export default DriverDetails;