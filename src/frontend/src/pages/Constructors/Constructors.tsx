import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getTeamStyle } from "../../data/teamStyles";

import {
  fetchDrivers,
  type Driver,
} from "../../data/f1Data";


function Constructors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await fetchDrivers();

        setDrivers(data);
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

    void loadDrivers();
  }, []);

  const constructors = Array.from(
  new Map(
    drivers.map((driver) => [
      driver.constructorId,
      {
        constructorId: driver.constructorId,
        name: driver.team,
      },
    ])
  ).values()
).filter((constructor) =>
  constructor.name
    .toLowerCase()
    .includes(searchTerm.toLowerCase())
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
            Formula 1 Team
          </p>

          <h2>{constructor.name}</h2>

          <span className="constructor-code">
            {constructor.constructorId}
          </span>
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