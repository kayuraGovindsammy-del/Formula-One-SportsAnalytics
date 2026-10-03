import { useState } from "react";
import { Link } from "react-router-dom";
import { getCircuitImage } from "../data/circuitImages";
import "./RaceCard.css";

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

type RaceTab = "race" | "qualifying" | "predictions";

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

  const [activeTab, setActiveTab] = useState<RaceTab>("race");

  const buttonLabel =
    activeTab === "race"
      ? "View Race"
      : activeTab === "qualifying"
        ? "View Qualifying"
        : "View Predictions";

  return (
    <article className="race-list-card">
      <header className="race-list-header">
        <span>Round {round}</span>
        <time dateTime={date}>{date}</time>
      </header>

      <Link
        to={`/races/${grandPrixId}`}
        className="race-card-main-link"
      >
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
        </div>
      </Link>

      <div className="race-card-tabs">
        <button
          type="button"
          className={activeTab === "race" ? "active" : ""}
          onClick={() => setActiveTab("race")}
        >
          Race
        </button>

        <button
          type="button"
          className={activeTab === "qualifying" ? "active" : ""}
          onClick={() => setActiveTab("qualifying")}
        >
          Qualifying
        </button>

        <button
          type="button"
          className={activeTab === "predictions" ? "active" : ""}
          onClick={() => setActiveTab("predictions")}
        >
          Predictions
        </button>
      </div>

      <div className="race-card-tab-content">
        {activeTab === "race" && (
          <div className="race-tab-panel">
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
        )}

        {activeTab === "qualifying" && (
          <div className="race-tab-panel race-tab-placeholder">
            <strong>Qualifying</strong>
            <p>Qualifying data coming soon.</p>
          </div>
        )}

        {activeTab === "predictions" && (
          <div className="race-tab-panel race-tab-placeholder">
            <strong>Predicted Times</strong>
            <p>
              Predictions will be available once qualifying data is recorded.
            </p>
          </div>
        )}
      </div>

      <Link
        to={`/races/${grandPrixId}`}
        className="race-card-view-button"
      >
        {buttonLabel}
      </Link>
    </article>
  );
}

export default RaceCard;