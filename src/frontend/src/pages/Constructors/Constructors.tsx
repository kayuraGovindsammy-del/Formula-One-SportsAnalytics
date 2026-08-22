import { useEffect, useState } from "react";

import {
  fetchDrivers,
  type Driver,
} from "../../data/f1Data";

import {
  CONSTRUCTOR_TEAM_NAMES,
} from "../../data/constructors";

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

  const constructors =
    CONSTRUCTOR_TEAM_NAMES.filter(
      (constructorName) =>
        constructorName
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

        <input
          id="constructor-search"
          type="search"
          placeholder="Search constructors..."
          value={searchTerm}
          onChange={(event) =>
            setSearchTerm(event.target.value)
          }
        />
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
        {constructors.map(
          (constructorName) => {
            const teamDrivers = drivers.filter(
              (driver) =>
                driver.team === constructorName
            );

            return (
              <article
                className="constructor-card"
                key={constructorName}
              >
                <header>
                  <h2>{constructorName}</h2>
                </header>

                <section className="constructor-drivers">
                  <h3>Drivers</h3>

                  {teamDrivers.length > 0 ? (
                    <ul>
                      {teamDrivers.map(
                        (driver) => (
                          <li
                            key={driver.driverId}
                          >
                            <span>
                              #{driver.number}
                            </span>

                            <strong>
                              {driver.name}
                            </strong>
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p>
                      Driver information unavailable.
                    </p>
                  )}
                </section>
              </article>
            );
          }
        )}
      </section>
    </main>
  );
}

export default Constructors;