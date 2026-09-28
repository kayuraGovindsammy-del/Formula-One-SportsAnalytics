import { useEffect, useState } from "react";
import DatasetDownloads from "../../components/DatasetDownloads";
import RaceCard from "../../components/RaceCard";
import { fetchRaces, type Race } from "../../data/f1Data";

const SEASON = "2025";

function Races() {
  const [races, setRaces] = useState<Race[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRaces = async () => {
      try {
        setLoading(true);
        setError("");
        setRaces(await fetchRaces());
      } catch (err) {
        console.error("Failed to load races:", err);
        setError("Failed to load races from the API.");
      } finally {
        setLoading(false);
      }
    };

    void loadRaces();
  }, []);

  const filteredRaces = races.filter((race) => {
    const search = searchTerm.toLowerCase();

    return (
      race.name.toLowerCase().includes(search) ||
      race.country.toLowerCase().includes(search) ||
      race.circuitName.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <main>
        <h1>{SEASON} Races</h1>
        <p>Loading races...</p>
      </main>
    );
  }

  return (
    <main>
      <section>
        <h1>{SEASON} Races</h1>
        <p>Browse races from the {SEASON} Formula 1 season.</p>
        <DatasetDownloads dataset="races" season={SEASON} label="races" />
      </section>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <section className="race-controls">
        <div className="race-search">
  <span className="race-search-icon" aria-hidden="true">
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
    placeholder="Search races..."
    value={searchTerm}
    onChange={(event) => setSearchTerm(event.target.value)}
    aria-label="Search races"
  />
</div>
      </section>

      <p className="results-count">
        Showing {filteredRaces.length} race
        {filteredRaces.length !== 1 ? "s" : ""}
      </p>

      <section className="races-grid">
        {filteredRaces.map((race) => (
          <RaceCard
            key={race.grandPrixId}
            grandPrixId={race.grandPrixId}
            round={race.round}
            name={race.name}
            circuitName={race.circuitName}
            locality={race.locality}
            country={race.country}
            date={race.date}
            hasSprint={race.hasSprint}
            hasResults={race.hasResults}
          />
        ))}
      </section>
    </main>
  );
}

export default Races;
