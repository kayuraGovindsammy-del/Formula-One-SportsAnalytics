import { useState } from "react";
import DriverCard from "../../components/DriverCard";
import { drivers } from "../../data/drivers";

function Drivers() {

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("All Teams");

  const filteredDrivers = drivers.filter((driver) => {
  const matchesSearch = driver.name
    .toLowerCase()
    .includes(searchTerm.toLowerCase());

  const matchesTeam =
    selectedTeam === "All Teams" || driver.team === selectedTeam;

  return matchesSearch && matchesTeam;
  });
  
  return (
    <main>
      <section>
        <h1>2025 Drivers</h1>
        <p>Browse drivers competing in the 2025 Formula 1 season.</p>
      </section>

      <section className="driver-controls">
        <input
            type="search"
            placeholder="Search drivers..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search drivers"
        />

        <select
          value={selectedTeam}
          onChange={(event) => setSelectedTeam(event.target.value)}
          aria-label="Filter drivers by team"
        >
          <option value="All Teams">All Teams</option>
          <option value="Alpine">Alpine</option>
          <option value="Aston Martin">Aston Martin</option>
          <option value="Ferrari">Ferrari</option>
          <option value="Haas F1 Team">Haas F1 Team</option>
          <option value="Kick Sauber">Kick Sauber</option>
          <option value="McLaren">McLaren</option>
          <option value="Mercedes">Mercedes</option>
          <option value="Racing Bulls">Racing Bulls</option>
          <option value="Red Bull Racing">Red Bull Racing</option>
          <option value="Williams">Williams</option>
        </select>
      </section>

      <p className="results-count">
       Showing {filteredDrivers.length} driver
       {filteredDrivers.length !== 1 ? "s" : ""}
      </p>

      <section className="drivers-grid">
        {filteredDrivers.map((driver) => (
          <DriverCard
            key={driver.number}
            name={driver.name}
            team={driver.team}
            number={driver.number}
            wins={driver.wins}
            points={driver.points}
            podiums={driver.podiums}
          />
        ))}
      </section>
    </main>
  );
}

export default Drivers;