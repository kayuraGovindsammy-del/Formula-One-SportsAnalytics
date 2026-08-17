type DriverCardProps = {
  name: string;
  team: string;
  number: number;
  wins: number;
  points: number;
  podiums: number;
};

function DriverCard({
  name,
  team,
  number,
  wins,
  points,
  podiums,
}: DriverCardProps) {
  return (
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
          <span>Wins</span>
          <strong>{wins}</strong>
        </div>

        <div>
          <span>Points</span>
          <strong>{points}</strong>
        </div>

        <div>
          <span>Podiums</span>
          <strong>{podiums}</strong>
        </div>
      </div>
    </article>
  );
}

export default DriverCard;