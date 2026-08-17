import { useState } from "react";
import RaceCard from "../../components/RaceCard";
import { races } from "../../data/races";

function Races() {

    const [searchTerm, setSearchTerm] = useState("");

    const filteredRaces = races.filter((race) => {
    const search = searchTerm.toLowerCase();

    return (
      race.name.toLowerCase().includes(search) ||
      race.country.toLowerCase().includes(search) ||
      race.circuit.toLowerCase().includes(search)
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
            id={race.id}
            key={race.id}
            round={race.round}
            name={race.name}
            circuit={race.circuit}
            country={race.country}
            date={race.date}
            winner={race.winner}
          />
        ))}
      </section>
    </main>
  );
}

export default Races;