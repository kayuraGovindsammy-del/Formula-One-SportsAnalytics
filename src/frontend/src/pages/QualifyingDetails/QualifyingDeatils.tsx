import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  fetchRace,
  fetchRaceQualifying,
  millisecondsToLapTime,
  type QualifyingData,
  type RaceDetail,
} from "../../data/f1Data";

import { getCircuitImage } from "../../data/circuitImages";

function QualifyingDetails() {
  const { id } = useParams();

  const [race, setRace] =
    useState<RaceDetail | null>(null);

  const [qualifying, setQualifying] =
    useState<QualifyingData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const loadQualifying = async () => {
      if (!id) {
        setError("Race not found.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [raceData, qualifyingData] =
          await Promise.all([
            fetchRace(id),
            fetchRaceQualifying(id),
          ]);

        setRace(raceData);
        setQualifying(qualifyingData);
      } catch (err) {
        console.error(
          "Failed to load qualifying:",
          err
        );

        setError(
          "Failed to load qualifying data."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadQualifying();
  }, [id]);

  if (loading) {
    return (
      <main>
        <h1>Qualifying</h1>
        <p>Loading qualifying results...</p>
      </main>
    );
  }

  if (error || !race) {
    return (
      <main>
        <h1>Qualifying not found</h1>
        <p style={{ color: "red" }}>
          {error}
        </p>
      </main>
    );
  }

  const circuitImage =
    getCircuitImage(race.country);

  return (
    <main>
      <section className="race-detail-header">
        <div className="race-detail-info">
          <p className="race-round">
            Round {race.round}
          </p>

          <h1>{race.name} Qualifying</h1>

          <p className="race-detail-circuit">
            {race.circuitName}
          </p>

          <p className="race-detail-location">
            {race.locality}, {race.country}
          </p>

          <time dateTime={race.date}>
            {race.date}
          </time>
        </div>

        {circuitImage && (
          <div className="race-detail-image-container">
            <img
              src={circuitImage}
              alt={`${race.name} circuit layout`}
              className="race-detail-image"
            />
          </div>
        )}
      </section>

      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          to={`/races/${race.grandPrixId}`}
          className="race-card-view-button"
        >
          View Race
        </Link>
      </div>

      <section className="race-chart-section">
        <div className="race-results-heading">
          <div>
            <p className="race-results-label">
              Session Results
            </p>

            <h2>Qualifying Classification</h2>
          </div>

          {qualifying &&
            qualifying.classification.length >
              0 && (
              <span className="race-results-count">
                {
                  qualifying.classification
                    .length
                }{" "}
                Drivers
              </span>
            )}
        </div>

        {qualifying &&
        qualifying.classification.length > 0 ? (
          <article className="race-detail-card race-classification-card">
            <div className="race-results-table">
              <div className="race-results-row race-results-header">
                <span>Pos</span>
                <span>Driver</span>
                <span>Constructor</span>
                <span>Q1</span>
                <span>Q2</span>
                <span>Q3</span>
              </div>

              {qualifying.classification.map(
                (result) => (
                  <div
                    key={result.driverId}
                    className={`race-results-row ${
                      result.position <= 3
                        ? `race-position-${result.position}`
                        : result.position <=
                            10
                          ? "race-points-position"
                          : ""
                    }`}
                  >
                    <strong className="race-result-position">
                      P{result.position}
                    </strong>

                    <div className="race-result-driver">
                      <strong>
                        {result.driverName}
                      </strong>
                    </div>

                    <span className="race-result-constructor">
                      {
                        result.constructorName
                      }
                    </span>

                    <span>
                      {result.q1TimeMs === null
                        ? "—"
                        : millisecondsToLapTime(
                            result.q1TimeMs
                          )}
                    </span>

                    <span>
                      {result.q2TimeMs === null
                        ? "—"
                        : millisecondsToLapTime(
                            result.q2TimeMs
                          )}
                    </span>

                    <span>
                      {result.q3TimeMs === null
                        ? "—"
                        : millisecondsToLapTime(
                            result.q3TimeMs
                          )}
                    </span>
                  </div>
                )
              )}
            </div>
          </article>
        ) : (
          <article className="race-detail-card">
            <p>
              Qualifying data is not
              available for this race yet.
            </p>
          </article>
        )}
      </section>
    </main>
  );
}

export default QualifyingDetails;