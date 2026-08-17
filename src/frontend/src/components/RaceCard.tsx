import { Link } from "react-router-dom";

type RaceCardProps = {
  id: number;
  round: number;
  name: string;
  circuit: string;
  country: string;
  date: string;
  winner: string;
};

function RaceCard({
  id,
  round,
  name,
  circuit,
  country,
  date,
  winner,
}: RaceCardProps) {
  return (
    <Link to={`/races/${id}`} className="race-card-link">
    <article className="race-list-card">
      <header className="race-list-header">
        <span>Round {round}</span>
        <time dateTime={date}>{date}</time>
      </header>

      <h2>{name}</h2>

      <p>
       <strong>Venue:</strong> {circuit}
      </p>

      <p>{country}</p>

      <div className="race-winner">
        <span>Winner</span>
        <strong>{winner}</strong>
      </div>
    </article>
    </Link>
  );
}

export default RaceCard;