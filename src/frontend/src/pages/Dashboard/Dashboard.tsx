import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchFeaturedRace,
  fetchSeasonSummary,
  type RecentRace,
} from "../../data/f1Data";

import { getCircuitImage } from "../../data/circuitImages";

interface SeasonSummary {
  season: string;
  raceCount: number;
  driverCount: number;
  constructorCount: number;
}

function Dashboard() {
  const [seasonSummary, setSeasonSummary] =
    useState<SeasonSummary | null>(null);

  const [featuredRace, setFeaturedRace] =
    useState<RecentRace | null>(null);

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
      } catch (err) {
        console.error("Failed to load dashboard:", err);

        setError(
          "Failed to load Formula 1 dashboard data from the API."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-status">
          <h1>Formula 1 Analytics</h1>
          <p>Loading dashboard data...</p>
        </section>
      </main>
    );
  }

  if (error || !seasonSummary || !featuredRace) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-status">
          <h1>Formula 1 Analytics</h1>

          <p className="dashboard-error">
            {error || "Dashboard data is unavailable."}
          </p>
        </section>
      </main>
    );
  }

  const circuitImage = getCircuitImage(featuredRace.country);

  return (
    <main className="dashboard-page">

      {/* HERO */}

      <section className="dashboard-hero">
        <div className="dashboard-hero-content">
          <p className="dashboard-eyebrow">
            {seasonSummary.season} Season
          </p>

          <h1>
            Formula 1
            <span> Analytics</span>
          </h1>

          <p className="dashboard-hero-description">
            Explore drivers, constructors, races and performance
            statistics from the {seasonSummary.season} Formula 1
            season.
          </p>

          <div className="dashboard-hero-actions">
            <Link
              to="/races"
              className="dashboard-primary-button"
            >
              Explore Races
            </Link>

            <Link
              to="/statistics"
              className="dashboard-secondary-button"
            >
              View Statistics
            </Link>
          </div>
        </div>

        <div className="dashboard-season-panel">
          <p>Season Overview</p>

          <div className="dashboard-season-number">
            {seasonSummary.season}
          </div>

          <div className="dashboard-season-stats">
            <div>
              <strong>{seasonSummary.raceCount}</strong>
              <span>Races</span>
            </div>

            <div>
              <strong>{seasonSummary.driverCount}</strong>
              <span>Drivers</span>
            </div>

            <div>
              <strong>{seasonSummary.constructorCount}</strong>
              <span>Teams</span>
            </div>
          </div>
        </div>
      </section>

      {/* NAVIGATION */}

      <section className="dashboard-navigation">
        <header className="dashboard-section-heading">
          <p>Explore</p>
          <h2>Formula 1 Analytics</h2>
        </header>

        <div className="dashboard-navigation-grid">

          <Link
            to="/drivers"
            className="dashboard-navigation-card"
          >
            <span className="dashboard-card-number">
              01
            </span>

            <div>
              <h3>Drivers</h3>

              <p>
                Explore the drivers competing throughout the
                season and analyse their performance.
              </p>
            </div>

            <span className="dashboard-card-arrow">
              →
            </span>
          </Link>

          <Link
            to="/races"
            className="dashboard-navigation-card"
          >
            <span className="dashboard-card-number">
              02
            </span>

            <div>
              <h3>Races</h3>

              <p>
                View race weekends, circuits, classifications
                and event statistics.
              </p>
            </div>

            <span className="dashboard-card-arrow">
              →
            </span>
          </Link>

          <Link
            to="/constructors"
            className="dashboard-navigation-card"
          >
            <span className="dashboard-card-number">
              03
            </span>

            <div>
              <h3>Constructors</h3>

              <p>
                Discover Formula 1 teams and the drivers
                representing each constructor.
              </p>
            </div>

            <span className="dashboard-card-arrow">
              →
            </span>
          </Link>

          <Link
            to="/statistics"
            className="dashboard-navigation-card"
          >
            <span className="dashboard-card-number">
              04
            </span>

            <div>
              <h3>Statistics</h3>

              <p>
                Compare race and season performance using
                calculated analytics.
              </p>
            </div>

            <span className="dashboard-card-arrow">
              →
            </span>
          </Link>

        </div>
      </section>

      {/* FEATURED RACE */}

      <section className="dashboard-featured-section">
        <header className="dashboard-section-heading">
          <p>Featured</p>
          <h2>Race Spotlight</h2>
        </header>

        <article className="dashboard-featured-race">

          <div className="dashboard-featured-info">
            <p className="dashboard-featured-round">
              Round {featuredRace.round}
            </p>

            <h3>{featuredRace.name}</h3>

            <p className="dashboard-featured-circuit">
              {featuredRace.circuitName}
            </p>

            <p className="dashboard-featured-location">
              {featuredRace.locality}, {featuredRace.country}
            </p>

            <Link
              to={`/races/${featuredRace.grandPrixId}`}
              className="dashboard-primary-button"
            >
              View Race
            </Link>
          </div>

          {circuitImage && (
            <div className="dashboard-featured-image">
              <img
                src={circuitImage}
                alt={`${featuredRace.name} circuit layout`}
              />
            </div>
          )}

        </article>
      </section>

      {/* CONTRIBUTOR ACCESS */}

<section className="dashboard-contributor-section">
  <div className="dashboard-contributor-content">
    <div>
      <p className="dashboard-contributor-label">
        Contribute
      </p>

      <h2>Help Build the Race Data</h2>

      <p>
        Approved contributors can submit Formula 1 race data
        for review by an administrator.
      </p>
    </div>

    <Link
      to="/account"
      className="dashboard-contributor-button"
    >
      Request Submitter Access
    </Link>
  </div>
</section>

    </main>
  );
}

export default Dashboard;