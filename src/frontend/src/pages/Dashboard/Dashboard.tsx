import { useEffect, useState } from "react";
import StatCard from "../../components/StatCard";
import {
  fetchFeaturedRace,
  fetchSeasonSummary,
  type ConstructorStanding,
  type DriverStanding,
  type RecentRace,
} from "../../data/f1Data";

interface SeasonSummary {
  season: string;
  raceCount: number;
  driverCount: number;
  constructorCount: number;
}

function Dashboard() {
  const [seasonSummary, setSeasonSummary] = useState<SeasonSummary | null>(null);
  const [featuredRace, setFeaturedRace] = useState<RecentRace | null>(null);
  const [driverStandings, setDriverStandings] = useState<DriverStanding[]>([]);
  const [constructorStandings, setConstructorStandings] = useState<
    ConstructorStanding[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const [summary, featured] = await Promise.all([
          fetchSeasonSummary(),
          fetchFeaturedRace(),
        ]);

        setSeasonSummary(summary);
        setFeaturedRace(featured.race);
        setDriverStandings(featured.driverStandings);
        setConstructorStandings(featured.constructorStandings);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        setError("Failed to load Formula 1 dashboard data from the API.");
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <main>
        <section>
          <h1>Formula 1 Analytics</h1>
          <p>Loading dashboard data...</p>
        </section>
      </main>
    );
  }

  if (error || !seasonSummary || !featuredRace) {
    return (
      <main>
        <section>
          <h1>Formula 1 Analytics</h1>
          <p style={{ color: "red" }}>
            {error || "Dashboard data is unavailable."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section>
        <h1>{seasonSummary.season} Formula 1 Season</h1>
        <p>Season overview and performance analytics.</p>
      </section>

      <section className="stats-grid">
        <StatCard title="Races" value={String(seasonSummary.raceCount)} />
        <StatCard title="Drivers" value={String(seasonSummary.driverCount)} />
        <StatCard
          title="Constructors"
          value={String(seasonSummary.constructorCount)}
        />
        <StatCard title="Season" value={String(seasonSummary.season)} />
      </section>

      <section className="standings-grid">
        <article className="standings-card">
          <h2>{featuredRace.name} Top Finishers</h2>

          <ol className="standings-list">
            {driverStandings.map((driver) => (
              <li key={driver.driverId}>
                <span>
                  {driver.position}. {driver.name}
                </span>
                <strong>{driver.team}</strong>
              </li>
            ))}
          </ol>
        </article>

        <article className="standings-card">
          <h2>{featuredRace.name} Constructors</h2>

          <ol className="standings-list">
            {constructorStandings.map((constructor) => (
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

      <section className="race-overview">
        <h2>Featured Race</h2>

        <article className="race-card">
          <header className="race-card-header">
            <div>
              <p>Round {featuredRace.round}</p>
              <h3>{featuredRace.name}</h3>
            </div>
            <span>{new Date(featuredRace.date).getFullYear()}</span>
          </header>

          <div className="race-details">
            <div>
              <p>Winner</p>
              <strong>{featuredRace.winner}</strong>
            </div>

            <div>
              <p>Fastest Lap</p>
              <strong>{featuredRace.fastestLapDriver}</strong>
              <p>{featuredRace.fastestLapTime}</p>
            </div>

            <div>
              <p>Circuit</p>
              <strong>{featuredRace.circuitName}</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

export default Dashboard;
