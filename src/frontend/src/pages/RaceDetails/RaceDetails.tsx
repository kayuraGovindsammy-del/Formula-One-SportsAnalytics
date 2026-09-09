import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import StatCard from "../../components/StatCard";
import { getCircuitImage } from "../../data/circuitImages";
import {
  fetchRace,
  fetchRaceStatistics,
  millisecondsToGap,
  type RaceDetail,
  type RaceStatistics,
} from "../../data/f1Data";

function RaceDetails() {
  const { id } = useParams();
  const [race, setRace] = useState<RaceDetail | null>(null);
  const [statistics, setStatistics] = useState<RaceStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRace = async () => {
      if (!id) {
        setError("Race not found.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const raceData = await fetchRace(id);
        setRace(raceData);

        if (raceData.hasResults) {
          setStatistics(await fetchRaceStatistics(id));
        } else {
          setStatistics(null);
        }
      } catch (err) {
        console.error("Failed to load race:", err);
        setError("Failed to load race details from the API.");
      } finally {
        setLoading(false);
      }
    };

    void loadRace();
  }, [id]);

  if (loading) {
    return (
      <main>
        <h1>Race Details</h1>
        <p>Loading race...</p>
      </main>
    );
  }

  if (error || !race) {
    return (
      <main>
        <h1>Race not found</h1>
        <p style={{ color: "red" }}>{error}</p>
      </main>
    );
  }

  const circuitImage = getCircuitImage(race.country);

  return (
    <main>
      <section className="race-detail-header">
  <div className="race-detail-info">
    <p className="race-round">Round {race.round}</p>

    <h1>{race.name}</h1>

    <p className="race-detail-circuit">
      {race.circuitName}
    </p>

    <p className="race-detail-location">
      {race.locality}, {race.country}
    </p>

    <time dateTime={race.date}>{race.date}</time>
  </div>

  {circuitImage && (
    <div className="race-detail-image-container">
      <img
        src={circuitImage}
        alt={`${race.name} circuit layout`}
        className="race-detail-image"
      />
    </div>
  )}
</section>

      {statistics ? (
        <>
          <section className="stats-grid">
            <StatCard
              title="Format"
              value={race.hasSprint ? "Sprint Weekend" : "Standard Weekend"}
            />
            <StatCard title="Fastest Lap" value={statistics.fastestLapTime} />
            <StatCard title="DNFs" value={String(statistics.dnfs)} />
            <StatCard title="Pit Stops" value={String(statistics.pitStops)} />
          </section>

          <section className="race-details-grid">
            <article className="race-detail-card">
              <h2>Race Results</h2>

              <div className="race-results">
                {statistics.classification.map((result) => (
                  <div
                    key={result.driverId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "50px 1fr 1fr 100px",
                      gap: "15px",
                      padding: "12px 0",
                      borderBottom: "1px solid #333",
                    }}
                  >
                    <strong>{result.position}</strong>
                    <span>{result.driverName}</span>
                    <span>{result.constructorName}</span>
                    <span>{millisecondsToGap(
    result.gapToWinnerMs
  )}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="race-detail-card">
              <h2>Race Overview</h2>

              <dl className="performance-list">
                <div>
                  <dt>Total Laps</dt>
                  <dd>{statistics.totalLaps ?? "Not available"}</dd>
                </div>

                <div>
                  <dt>Fastest Lap</dt>
                  <dd>
                    {statistics.fastestLapDriverName} — {statistics.fastestLapTime}
                  </dd>
                </div>

                <div>
                  <dt>Fastest Lap Number</dt>
                  <dd>
                    {statistics.fastestLapNumber === null
                      ? "Not available"
                      : `Lap ${statistics.fastestLapNumber}`}
                  </dd>
                </div>

                <div>
                  <dt>Overtakes Recorded</dt>
                  <dd>{statistics.overtakes}</dd>
                </div>

                <div>
                  <dt>Pit Stops Recorded</dt>
                  <dd>{statistics.pitStops}</dd>
                </div>

                <div>
                  <dt>Retirements Recorded</dt>
                  <dd>{statistics.retirements}</dd>
                </div>
              </dl>
            </article>
          </section>

          <section className="race-chart-section">
            <h2>Event Data Summary</h2>

            <article className="race-detail-card">
              <p>
                These statistics are derived by the backend from the race lap
                and event data.
              </p>
              <p>
                Session ID: <strong>{statistics.sessionId}</strong>
              </p>
            </article>
          </section>
        </>
      ) : (
        <>
          <section className="stats-grid">
            <StatCard
              title="Format"
              value={race.hasSprint ? "Sprint Weekend" : "Standard Weekend"}
            />
            <StatCard title="Fastest Lap" value="Not available" />
            <StatCard title="DNFs" value="Not available" />
            <StatCard title="Pit Stops" value="Not available" />
          </section>

          <section className="race-details-grid">
            <article className="race-detail-card">
              <h2>Race Results</h2>
              <p>Detailed event data is not currently available for this race.</p>
            </article>

            <article className="race-detail-card">
              <h2>Race Overview</h2>
              <p>Race statistics will be available when event data is added.</p>
            </article>
          </section>
        </>
      )}
    </main>
  );
}

export default RaceDetails;
