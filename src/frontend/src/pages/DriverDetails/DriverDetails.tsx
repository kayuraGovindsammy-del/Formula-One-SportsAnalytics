import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import StatCard from "../../components/StatCard";
import type { CSSProperties } from "react";
import { getDriverImage } from "../../data/driverImages";
import { getTeamStyle } from "../../data/teamStyles";
import {
  fetchDriver,
  fetchDriverStatistics,
  millisecondsToLapTime,
  type Driver,
  type DriverStatistics,
} from "../../data/f1Data";

function DriverDetails() {
  const { id } = useParams();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [statistics, setStatistics] = useState<DriverStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDriver = async () => {
      if (!id) {
        setError("Driver not found.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [driverData, statsData] = await Promise.all([
          fetchDriver(id),
          fetchDriverStatistics(id, "2025"),
        ]);

        setDriver(driverData);
        setStatistics(statsData);
      } catch (err) {
        console.error("Failed to load driver:", err);
        setError("Failed to load driver details from the API.");
      } finally {
        setLoading(false);
      }
    };

    void loadDriver();
  }, [id]);

  if (loading) {
    return (
      <main>
        <h1>Driver Details</h1>
        <p>Loading driver...</p>
      </main>
    );
  }

  if (error || !driver || !statistics) {
    return (
      <main>
        <h1>Driver not found</h1>
        <p style={{ color: "red" }}>{error}</p>
      </main>
    );
  }

  const driverImage = getDriverImage(driver.driverId); 
  const teamStyle = getTeamStyle(driver.constructorId);

  return (
  <main
    className="driver-details-page"
    style={
      {
        "--team-color": teamStyle.primary,
      } as CSSProperties
    }
  >

    <div className="driver-page-content">
      <section className="driver-detail-hero">
  <div className="driver-detail-info">
    <p className="driver-profile-number">
      #{driver.number}
    </p>

    <h1>{driver.name}</h1>

    <p className="driver-profile-team">
      {driver.team}
    </p>

    <div className="driver-profile-meta">
      <div>
        <span>Nationality</span>
        <strong>{driver.nationality}</strong>
      </div>

      <div>
        <span>Date of Birth</span>
        <strong>{driver.dateOfBirth}</strong>
      </div>
    </div>
  </div>

  <div className="driver-detail-image-container">
    <img
      src={driverImage}
      alt={driver.name}
      className="driver-detail-image"
    />
  </div>
</section>

      <section className="stats-grid driver-stats-grid">
        <StatCard title="Wins" value={String(statistics.wins)} />
        <StatCard title="Podiums" value={String(statistics.podiums)} />
        <StatCard
          title="Fastest Laps"
          value={String(statistics.fastestLaps)}
        />
        <StatCard title="DNFs" value={String(statistics.dnfCount)} />
      </section>

      <section className="driver-details-grid">
        <article className="driver-detail-card">
          <h2>Driver Information</h2>

          <dl className="performance-list">
            <div>
              <dt>Nationality</dt>
              <dd>{driver.nationality}</dd>
            </div>

            <div>
              <dt>Date of Birth</dt>
              <dd>{driver.dateOfBirth}</dd>
            </div>

            <div>
              <dt>Team</dt>
              <dd>{driver.team}</dd>
            </div>

            <div>
              <dt>Driver Number</dt>
              <dd>{driver.number}</dd>
            </div>
          </dl>
        </article>

        <article className="driver-detail-card">
          <h2>2025 Performance</h2>

          <dl className="performance-list">
            <div>
              <dt>Races Entered</dt>
              <dd>{statistics.racesEntered}</dd>
            </div>

            <div>
              <dt>Average Finish</dt>
              <dd>
                {statistics.averageFinishPosition ?? "Not available"}
              </dd>
            </div>

            <div>
              <dt>Fastest Laps</dt>
              <dd>{statistics.fastestLaps}</dd>
            </div>

            <div>
              <dt>Average Race Pace</dt>
              <dd>
                {statistics.averageRacePaceMs === null
                  ? "Not available"
                  : millisecondsToLapTime(statistics.averageRacePaceMs)}
              </dd>
            </div>

            <div>
              <dt>Positions Gained/Lost</dt>
              <dd>
                {statistics.positionsGainedLostAvg ?? "Not available"}
              </dd>
            </div>

            <div>
              <dt>DNF Rate</dt>
              <dd>
                {statistics.dnfRate === null
                  ? "Not available"
                  : `${(statistics.dnfRate * 100).toFixed(1)}%`}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="driver-results-section">
        <h2>Season Data</h2>

        <article className="driver-detail-card">
          <p>
            Statistics are derived by the backend from the available 2025 lap
            and event data.
          </p>
        </article>
      </section>
    </div>
  </main>
);
}

export default DriverDetails;
