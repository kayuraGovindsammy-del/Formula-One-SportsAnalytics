import { Link } from "react-router-dom";

type DriverCardProps = {
  driverId: string;
  name: string;
  team: string;
  number: number;
  nationality: string;
  dateOfBirth: string;
};

function DriverCard({
  driverId,
  name,
  team,
  number,
  nationality,
  dateOfBirth,
}: DriverCardProps) {
  return (
    <Link to={`/drivers/${driverId}`} className="driver-card-link">
    <article className="driver-card">
      <div className="driver-header">
        <div className="driver-number">{number}</div>

        <div>
          <h3>{name}</h3>
          <p>{team}</p>
        </div>
      </div>

      <div className="driver-stats">
        <div>
          <span>Nationality</span>
          <strong>{nationality}</strong>
        </div>

        <div>
          <span>Born</span>
          <strong>{dateOfBirth}</strong>
        </div>
      </div>
    </article>
    </Link>
  );
}

export default DriverCard;
