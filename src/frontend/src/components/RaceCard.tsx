import { Link } from "react-router-dom";
import { getCircuitImage } from "../data/circuitImages";

type RaceCardProps = {
  grandPrixId: string;
  round: number;
  name: string;
  circuitName: string;
  locality: string;
  country: string;
  date: string;
  hasSprint: boolean;
  hasResults: boolean;
};

function RaceCard({
  grandPrixId,
  round,
  name,
  circuitName,
  locality,
  country,
  date,
  hasSprint,
  hasResults,
}: RaceCardProps) {
  const circuitImage = getCircuitImage(country);
 return (
    <Link to={`/races/${grandPrixId}`} className="race-card-link">
      <article className="race-list-card">
        <header className="race-list-header">
          <span>Round {round}</span>
          <time dateTime={date}>{date}</time>
        </header>

        <div className="race-circuit-container">
          {circuitImage && (
            <img
              src={circuitImage}
              alt={`${name} circuit layout`}
              className="race-circuit-image"
            />
          )}
        </div>

        <div className="race-card-content">
          <h2>{name}</h2>

          <p>
            <strong>Venue:</strong> {circuitName}, {locality}
          </p>

          <p className="race-country">{country}</p>

          <div className="race-info-row">
            <span>Format</span>
            <strong>
              {hasSprint ? "Sprint Weekend" : "Standard Weekend"}
            </strong>
          </div>

          <div className="race-info-row">
            <span>Statistics</span>
            <strong>
              {hasResults ? "Available" : "Not available"}
            </strong>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default RaceCard;
