import { Link } from "react-router-dom";

type RaceCardProps = {
  round: number;
  name: string;
  circuitName: string;
  locality: string;
  country: string;
  date: string;
  hasSprint: boolean;
};

function RaceCard({
  round,
  name,
  circuitName,
  locality,
  country,
  date,
  hasSprint,
}: RaceCardProps) {
  return (
    <Link to={`/races/${round}`} className="race-card-link">
    <article className="race-list-card">
      <header className="race-list-header">
        <span>Round {round}</span>
        <time dateTime={date}>{date}</time>
      </header>

      <h2>{name}</h2>

      <p>
       <strong>Venue:</strong> {circuitName}, {locality}
      </p>

      <p>{country}</p>

      <div className="race-winner">
        <span>Format</span>
        <strong>{hasSprint ? "Sprint Weekend" : "Standard Weekend"}</strong>
      </div>
    </article>
    </Link>
  );
}

export default RaceCard;
