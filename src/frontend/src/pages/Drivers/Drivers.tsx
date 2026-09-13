import { useEffect, useMemo, useState } from "react";
import DriverCard from "../../components/DriverCard";
import { fetchDrivers, type Driver } from "../../data/f1Data";

function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("All Teams");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        setLoading(true);
        setError("");
        setDrivers(await fetchDrivers());
      } catch (err) {
        console.error("Failed to load drivers:", err);
        setError("Failed to load drivers from the API.");
      } finally {
        setLoading(false);
      }
    };

    void loadDrivers();
  }, []);

  const teams = useMemo(
    () => Array.from(new Set(drivers.map((driver) => driver.team))).sort(),
    [drivers]
  );

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch = driver.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesTeam =
      selectedTeam === "All Teams" || driver.team === selectedTeam;

    return matchesSearch && matchesTeam;
  });

  if (loading) {
    return (
      <main>
        <h1>2025 Drivers</h1>
        <p>Loading drivers...</p>
      </main>
    );
  }

  return (
    <main>
      <section>
        <h1>2025 Drivers</h1>
        <p>Browse drivers competing in the 2025 Formula 1 season.</p>
      </section>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <section className="driver-controls">
        <div className="driver-search">
  <span className="driver-search-icon" aria-hidden="true">
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
    placeholder="Search drivers..."
    value={searchTerm}
    onChange={(event) => setSearchTerm(event.target.value)}
    aria-label="Search drivers"
  />
</div>

        <select
          value={selectedTeam}
          onChange={(event) => setSelectedTeam(event.target.value)}
          aria-label="Filter drivers by team"
        >
          <option value="All Teams">All Teams</option>
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>
      </section>

      <p className="results-count">
        Showing {filteredDrivers.length} driver
        {filteredDrivers.length !== 1 ? "s" : ""}
      </p>

      <section className="drivers-grid">
        {filteredDrivers.map((driver) => (
          <DriverCard
            driverId={driver.driverId}
            key={driver.driverId}
            name={driver.name}
            team={driver.team}
            constructorId={driver.constructorId}
            number={driver.number}
            nationality={driver.nationality}
            dateOfBirth={driver.dateOfBirth}
          />
        ))}
      </section>
    </main>
  );
}

export default Drivers;
