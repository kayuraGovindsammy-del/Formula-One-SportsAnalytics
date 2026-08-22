import { useState } from "react";
import { drivers } from "../../data/f1Data";
import {
  CONSTRUCTOR_TEAM_NAMES,
  getConstructorName,
} from "../../data/constructors";

function Constructors() {
  const [searchTerm, setSearchTerm] = useState("");

  const constructors = CONSTRUCTOR_TEAM_NAMES.filter((constructorName) =>
    constructorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main>
      <section>
        <h1>2025 Constructors</h1>
        <p>
          Explore the Formula 1 constructors and drivers competing during the
          2025 season.
        </p>
      </section>

      <section className="constructor-controls">
        <label htmlFor="constructor-search">Search constructors</label>

        <input
          id="constructor-search"
          type="search"
          placeholder="Search constructors..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </section>

      <p className="results-count">
        Showing {constructors.length} constructor
        {constructors.length !== 1 ? "s" : ""}
      </p>

      <section className="constructors-grid">
        {constructors.map((constructorName) => {
          const teamDrivers = drivers.filter(
            (driver) => driver.team === constructorName
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
                    {teamDrivers.map((driver) => (
                      <li key={driver.driverId}>
                        <span>#{driver.number}</span>
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