import { useState } from "react";
import RaceCard from "../../components/RaceCard";
import { races } from "../../data/f1Data";

function Races() {

    const [searchTerm, setSearchTerm] = useState("");

    const filteredRaces = races.filter((race) => {
    const search = searchTerm.toLowerCase();

    return (
      race.name.toLowerCase().includes(search) ||
      race.country.toLowerCase().includes(search) ||
      race.circuitName.toLowerCase().includes(search)
    );
    });
  return (
    <main>
      <section>
        <h1>2025 Races</h1>
        <p>Browse races from the 2025 Formula 1 season.</p>
      </section>
      <section className="race-controls">
      <input
        type="search"
        placeholder="Search races..."
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        aria-label="Search races"
       />
       </section>

      <p className="results-count">
      Showing {filteredRaces.length} race
       {filteredRaces.length !== 1 ? "s" : ""}
      </p>

      <section className="races-grid">
        {filteredRaces.map((race) => (
          <RaceCard
            key={race.round}
            round={race.round}
            name={race.name}
            circuitName={race.circuitName}
            locality={race.locality}
            country={race.country}
            date={race.date}
            hasSprint={race.hasSprint}
          />
        ))}
      </section>
    </main>
  );
}

export default Races;