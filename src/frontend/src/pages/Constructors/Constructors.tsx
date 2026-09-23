import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getTeamStyle } from "../../data/teamStyles";

import {
  fetchConstructorStatistics,
  fetchDrivers,
  type Driver,
} from "../../data/f1Data";

const SEASON = "2025";

function Constructors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [pointsByConstructor, setPointsByConstructor] = useState<
    Record<string, number | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadConstructors = async () => {
      try {
        setLoading(true);
        setError("");

        const driverData = await fetchDrivers();
        setDrivers(driverData);

        const constructorIds = Array.from(
          new Set(driverData.map((driver) => driver.constructorId))
        );

        // One call per constructor — the API has no batch/standings
        // endpoint — fired in parallel so the page pays for one round trip,
        // not N sequential ones. allSettled rather than all: one
        // constructor's stats failing (e.g. no season data yet) shouldn't
        // blank the whole page, just that card's points.
        const results = await Promise.allSettled(
          constructorIds.map((constructorId) =>
            fetchConstructorStatistics(constructorId, SEASON)
          )
        );

        const points: Record<string, number | null> = {};
        results.forEach((result, index) => {
          const constructorId = constructorIds[index];
          if (!constructorId) return;

          points[constructorId] =
            result.status === "fulfilled" ? result.value.points : null;
        });

        setPointsByConstructor(points);
      } catch (err) {
        console.error(
          "Failed to load constructor drivers:",
          err
        );

        setError(
          "Failed to load constructor information."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadConstructors();
  }, []);

  // Full 2025 standings, independent of the search box — ranks (P1, P2, ...)
  // are assigned here so they stay stable as the search term changes rather
  // than reflecting each filtered view's own position.
  const standings = Array.from(
    new Map(
      drivers.map((driver) => [
        driver.constructorId,
        {
          constructorId: driver.constructorId,
          name: driver.team,
          points: pointsByConstructor[driver.constructorId] ?? null,
        },
      ])
    ).values()
  )
    .sort((a, b) => {
      // Standings order: highest points first, null (no data) sorts last
      // regardless of value rather than being treated as 0.
      if (a.points === null && b.points === null) return 0;
      if (a.points === null) return 1;
      if (b.points === null) return -1;
      return b.points - a.points;
    })
    .map((constructor, index) => ({
      ...constructor,
      rank: constructor.points !== null ? index + 1 : null,
    }));

  const constructors = standings.filter((constructor) =>
    constructor.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <main>
        <section>
          <h1>2025 Constructors</h1>
          <p>Loading constructors...</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section>
        <h1>2025 Constructors</h1>

        <p>
          Explore the Formula 1 constructors and drivers
          competing during the 2025 season.
        </p>
      </section>

      <section className="constructor-controls">
        <label htmlFor="constructor-search">
          Search constructors
        </label>

        <div className="constructor-search">
  <span className="constructor-search-icon" aria-hidden="true">
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  </span>

  <input
    type="search"
    placeholder="Search constructors..."
    value={searchTerm}
    onChange={(event) => setSearchTerm(event.target.value)}
    aria-label="Search constructors"
  />
</div>
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

      <p className="results-count">
        Showing {constructors.length} constructor
        {constructors.length !== 1 ? "s" : ""}
      </p>

      <section className="constructors-grid">
  {constructors.map((constructor) => {
    const teamStyle = getTeamStyle(constructor.constructorId);

    const teamDrivers = drivers.filter(
      (driver) =>
        driver.constructorId === constructor.constructorId
    );

    return (
      <article
        className="constructor-card"
        key={constructor.constructorId}
        style={
          {
            "--team-color": teamStyle.primary,
            "--team-text-color": teamStyle.secondary,
          } as CSSProperties
        }
      >
        <div className="constructor-card-accent" />

        <header className="constructor-card-header">
          <p className="constructor-label">
            {constructor.rank !== null
              ? `Formula 1 Team — P${constructor.rank}`
              : "Formula 1 Team"}
          </p>

          <h2>{constructor.name}</h2>

          <span className="constructor-code">
            {constructor.constructorId}
          </span>

          <p className="constructor-points">
            {constructor.points !== null
              ? `${constructor.points} pts (${SEASON})`
              : "No points data yet"}
          </p>
        </header>

        <section className="constructor-drivers">
          <h3>Drivers</h3>

          {teamDrivers.length > 0 ? (
            <ul>
              {teamDrivers.map((driver) => (
                <li key={driver.driverId}>
                  <span className="constructor-driver-number">
                    #{driver.number}
                  </span>

                  <strong>{driver.name}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Driver information unavailable.</p>
          )}
        </section>
      </article>
    );
  })}
</section>
    </main>
  );
}

export default Constructors;