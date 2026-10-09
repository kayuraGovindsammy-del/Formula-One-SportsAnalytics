import { Link } from "react-router-dom";
import { getTeamStyle } from "../data/teamStyles";
import { getDriverImage } from "../data/driverImages";

type DriverCardProps = {
  driverId: string;
  name: string;
  team: string;
  constructorId: string;
  number: number;
  nationality: string;
  dateOfBirth: string;
  points: number | null;
  rank: number | null;
};

function DriverCard({
  driverId,
  name,
  team,
  constructorId,
  number,
  nationality,
  dateOfBirth,
  points,
  rank,
}: DriverCardProps) {
  const teamStyle = getTeamStyle(constructorId);
  const driverImage = getDriverImage(driverId);
  return (
    <Link to={`/drivers/${driverId}`} className="driver-card-link">
    <article className="driver-card"
        style={
          {
            "--team-color": teamStyle.primary,
          } as React.CSSProperties
        }
    >
      <div className="driver-image-container">
         <img
        src={driverImage}
        alt={`${name}`}
        className="driver-image"
         />
      </div>
      <div className="driver-header">
        <div className="driver-number">{number}</div>

        <div>
          <h3>{name}</h3>
          <p>{team}</p>
        </div>
      </div>

      <div className="driver-standing">
  <span>
    {rank !== null
      ? `Championship P${rank}`
      : "No standing yet"}
  </span>

  <strong>
    {points !== null
      ? `${points} pts`
      : "No points data"}
  </strong>
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
