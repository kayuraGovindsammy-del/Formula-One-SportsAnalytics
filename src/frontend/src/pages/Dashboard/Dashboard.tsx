import StatCard from "../../components/StatCard";

function Dashboard() {
  const driverStandings = [
    { position: 1, name: "Driver A", points: 0 },
    { position: 2, name: "Driver B", points: 0 },
    { position: 3, name: "Driver C", points: 0 },
  ];

  const constructorStandings = [
    { position: 1, name: "Constructor A", points: 0 },
    { position: 2, name: "Constructor B", points: 0 },
    { position: 3, name: "Constructor C", points: 0 },
  ];

  return (
    <main>
      <section>
        <h1>2025 Formula 1 Season</h1>
        <p>Season overview and performance analytics.</p>
      </section>

      <section className="stats-grid">
        <StatCard title="Races" value="24" />
        <StatCard title="Drivers" value="20" />
        <StatCard title="Constructors" value="10" />
        <StatCard title="Season" value="2025" />
      </section>

      <section className="standings-grid">
        <article className="standings-card">
          <h2>Driver Standings</h2>

          <ol className="standings-list">
            {driverStandings.map((driver) => (
              <li key={driver.position}>
                <span>
                  {driver.position}. {driver.name}
                </span>

                <strong>{driver.points} pts</strong>
              </li>
            ))}
          </ol>
        </article>

        <article className="standings-card">
          <h2>Constructor Standings</h2>

          <ol className="standings-list">
            {constructorStandings.map((constructor) => (
              <li key={constructor.position}>
                <span>
                  {constructor.position}. {constructor.name}
                </span>

                <strong>{constructor.points} pts</strong>
              </li>
            ))}
          </ol>
        </article>
      </section>
      <section className="race-overview">
  <h2>Recent Race</h2>

  <article className="race-card">
    <header className="race-card-header">
      <div>
        <p>Round</p>
        <h3>Grand Prix</h3>
      </div>

      <span>2025</span>
    </header>

    <div className="race-details">
      <div>
        <p>Winner</p>
        <strong>Driver</strong>
      </div>

      <div>
        <p>Fastest Lap</p>
        <strong>Driver</strong>
      </div>

      <div>
        <p>Circuit</p>
        <strong>Circuit Name</strong>
      </div>
    </div>
  </article>
</section>
    </main>
  );
}

export default Dashboard;