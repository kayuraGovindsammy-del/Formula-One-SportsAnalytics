import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import {
  fetchDriverStatistics,
  fetchRace,
  fetchRaceQualifying,
  millisecondsToLapTime,
  type QualifyingData,
  type RaceDetail,
} from "../../data/f1Data";

import { getCircuitImage } from "../../data/circuitImages";

import "./PredictionsDetails.css";

type DriverPredictionStats = {
  averageFinishPosition: number | null;
  averageRacePaceMs: number | null;
};

type Prediction = {
  driverId: string;
  driverName: string;
  constructorName: string;

  qualifyingPosition: number;
  qualifyingTimeMs: number;

  averageFinishPosition: number | null;
  averageRacePaceMs: number | null;

  predictedTimeMs: number;
  predictionScore: number;
  predictedPosition: number;
};

/*
 * Approximate difference between qualifying pace
 * and expected race pace.
 */
const QUALIFYING_TO_RACE_FACTOR = 1.07;

/*
 * Predicted finishing position:
 *
 * 60% current qualifying position
 * 40% previous average finishing position
 */
const QUALIFYING_WEIGHT = 0.6;
const FINISH_WEIGHT = 0.4;

function PredictionsDetails() {
  const { id } = useParams();

  const [race, setRace] =
    useState<RaceDetail | null>(null);

  const [qualifying, setQualifying] =
    useState<QualifyingData | null>(null);

  const [driverStats, setDriverStats] =
    useState<
      Record<
        string,
        DriverPredictionStats
      >
    >({});

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const loadPredictions = async () => {
      if (!id) {
        setError("Race not found.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        /*
         * Load the race and qualifying
         * information first.
         */
        const [
          raceData,
          qualifyingData,
        ] = await Promise.all([
          fetchRace(id),
          fetchRaceQualifying(id),
        ]);

        /*
         * Fetch season statistics for
         * every driver in qualifying.
         */
        const statsResults =
          await Promise.allSettled(
            qualifyingData.classification.map(
              (driver) =>
                fetchDriverStatistics(
                  driver.driverId,
                  raceData.seasonId
                )
            )
          );

        const statsByDriver: Record<
          string,
          DriverPredictionStats
        > = {};

        statsResults.forEach(
          (result, index) => {
            const driver =
              qualifyingData
                .classification[index];

            if (!driver) {
              return;
            }

            if (
              result.status ===
              "fulfilled"
            ) {
              statsByDriver[
                driver.driverId
              ] = {
                averageFinishPosition:
                  result.value
                    .averageFinishPosition,

                averageRacePaceMs:
                  result.value
                    .averageRacePaceMs,
              };
            } else {
              statsByDriver[
                driver.driverId
              ] = {
                averageFinishPosition:
                  null,

                averageRacePaceMs:
                  null,
              };
            }
          }
        );

        setRace(raceData);
        setQualifying(qualifyingData);
        setDriverStats(statsByDriver);
      } catch (err) {
        console.error(
          "Failed to load prediction data:",
          err
        );

        setError(
          "Failed to load prediction data."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadPredictions();
  }, [id]);

  const predictions =
    useMemo<Prediction[]>(() => {
      if (!qualifying) {
        return [];
      }

      /*
       * STEP 1:
       * Build prediction data from
       * qualifying and historical stats.
       */
      const basePredictions =
        qualifying.classification.flatMap(
          (driver) => {
            const availableTimes = [
              driver.q1TimeMs,
              driver.q2TimeMs,
              driver.q3TimeMs,
            ].filter(
              (time): time is number =>
                typeof time ===
                  "number" &&
                Number.isFinite(time) &&
                time > 0
            );

            /*
             * We need at least one
             * qualifying lap time.
             */
            if (
              availableTimes.length ===
              0
            ) {
              return [];
            }

            const bestQualifyingTime =
              Math.min(
                ...availableTimes
              );

            const stats =
              driverStats[
                driver.driverId
              ];

            const historicalRacePace =
              stats?.averageRacePaceMs ??
              null;

            /*
             * Qualifying-based race pace
             * estimate.
             */
            const qualifyingRaceEstimate =
              Math.round(
                bestQualifyingTime *
                  QUALIFYING_TO_RACE_FACTOR
              );

            /*
             * If we have historical race pace,
             * combine it with the current
             * qualifying-based estimate.
             *
             * 60% current qualifying estimate
             * 40% historical race pace
             */
            const predictedTimeMs =
              historicalRacePace !== null
                ? Math.round(
                    qualifyingRaceEstimate *
                      0.6 +
                      historicalRacePace *
                        0.4
                  )
                : qualifyingRaceEstimate;

            return [
              {
                driverId:
                  driver.driverId,

                driverName:
                  driver.driverName,

                constructorName:
                  driver.constructorName,

                qualifyingPosition:
                  driver.position,

                qualifyingTimeMs:
                  bestQualifyingTime,

                averageFinishPosition:
                  stats?.averageFinishPosition ??
                  null,

                averageRacePaceMs:
                  historicalRacePace,

                predictedTimeMs,

                predictionScore: 0,

                predictedPosition: 0,
              },
            ];
          }
        );

      /*
       * STEP 2:
       * Calculate finishing-position score.
       *
       * Lower score = better prediction.
       *
       * 60% qualifying position
       * 40% average finish position
       */
      const scoredPredictions =
        basePredictions.map(
          (driver) => {
            /*
             * If historical finish data
             * is missing, use qualifying
             * position as fallback.
             */
            const finishPosition =
              driver.averageFinishPosition ??
              driver.qualifyingPosition;

            const predictionScore =
              driver.qualifyingPosition *
                QUALIFYING_WEIGHT +
              finishPosition *
                FINISH_WEIGHT;

            return {
              ...driver,
              predictionScore,
            };
          }
        );

      /*
       * STEP 3:
       * Sort drivers into predicted race order.
       */
      return scoredPredictions
        .sort((a, b) => {
          if (
            a.predictionScore !==
            b.predictionScore
          ) {
            return (
              a.predictionScore -
              b.predictionScore
            );
          }

          /*
           * If two drivers have the same
           * finishing score, use predicted
           * race pace as the tie breaker.
           */
          return (
            a.predictedTimeMs -
            b.predictedTimeMs
          );
        })
        .map((driver, index) => ({
          ...driver,
          predictedPosition:
            index + 1,
        }));
    }, [
      qualifying,
      driverStats,
    ]);

  if (loading) {
    return (
      <main>
        <h1>Race Predictions</h1>

        <p>
          Analysing qualifying and
          previous race performance...
        </p>
      </main>
    );
  }

  if (error || !race) {
    return (
      <main>
        <h1>
          Predictions unavailable
        </h1>

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
      {/* HEADER */}

      <section className="race-detail-header">
        <div className="race-detail-info">
          <p className="race-round">
            Round {race.round}
          </p>

          <h1>
            {race.name} Predictions
          </h1>

          <p className="race-detail-circuit">
            {race.circuitName}
          </p>

          <p className="race-detail-location">
            {race.locality},{" "}
            {race.country}
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

      {/* NAVIGATION */}

      <div className="prediction-navigation">
        <Link
          to={`/races/${race.grandPrixId}`}
          className="race-card-view-button"
        >
          Race
        </Link>

        <Link
          to={`/races/${race.grandPrixId}/qualifying`}
          className="race-card-view-button"
        >
          Qualifying
        </Link>
      </div>

      {/* INTRO */}

      <section className="prediction-intro">
        <p className="race-results-label">
          Performance Forecast
        </p>

        <h2>
          Predicted Race Result
        </h2>

        <p>
          Predicted finishing positions
          combine current qualifying
          performance with each driver's
          previous finishing performance
          during the season.
        </p>

        <div className="prediction-formula">
          <span>
            <strong>60%</strong>{" "}
            Qualifying
          </span>

          <span>
            <strong>40%</strong>{" "}
            Previous Results
          </span>
        </div>
      </section>

      {/* PREDICTIONS */}

      {predictions.length > 0 ? (
        <section className="prediction-card">
          <div className="prediction-table">
            <div className="prediction-row prediction-header">
              <span>
                Predicted
              </span>

              <span>
                Driver
              </span>

              <span>
                Constructor
              </span>

              <span>
                Quali
              </span>

              <span>
                Avg Finish
              </span>

              <span>
                Predicted Pace
              </span>
            </div>

            {predictions.map(
              (prediction) => (
                <div
                  key={
                    prediction.driverId
                  }
                  className={`prediction-row ${
                    prediction.predictedPosition <=
                    3
                      ? `prediction-top-${prediction.predictedPosition}`
                      : ""
                  }`}
                >
                  {/* PREDICTED POSITION */}

                  <strong className="predicted-position">
                    P
                    {
                      prediction.predictedPosition
                    }
                  </strong>

                  {/* DRIVER */}

                  <strong>
                    {
                      prediction.driverName
                    }
                  </strong>

                  {/* CONSTRUCTOR */}

                  <span>
                    {
                      prediction.constructorName
                    }
                  </span>

                  {/* QUALIFYING */}

                  <span>
                    P
                    {
                      prediction.qualifyingPosition
                    }
                  </span>

                  {/* AVERAGE FINISH */}

                  <span>
                    {prediction.averageFinishPosition !==
                    null
                      ? `P${prediction.averageFinishPosition.toFixed(
                          1
                        )}`
                      : "—"}
                  </span>

                  {/* PREDICTED PACE */}

                  <strong className="predicted-time">
                    {millisecondsToLapTime(
                      prediction.predictedTimeMs
                    )}
                  </strong>
                </div>
              )
            )}
          </div>
        </section>
      ) : (
        <article className="race-detail-card">
          <h2>
            Predictions unavailable
          </h2>

          <p>
            Predictions cannot be
            calculated until qualifying
            lap times are available.
          </p>
        </article>
      )}

      {/* EXPLANATION */}

      <section className="prediction-method">
        <h2>
          How is this predicted?
        </h2>

        <div className="prediction-method-grid">
          <article>
            <strong>
              Qualifying Performance
            </strong>

            <p>
              The driver's current
              qualifying position
              contributes 60% of the
              predicted finishing
              position.
            </p>
          </article>

          <article>
            <strong>
              Previous Results
            </strong>

            <p>
              The driver's average
              finishing position during
              the season contributes the
              remaining 40%.
            </p>
          </article>

          <article>
            <strong>
              Predicted Race Pace
            </strong>

            <p>
              Predicted lap pace combines
              the driver's fastest
              qualifying lap with
              historical average race
              pace when that data is
              available.
            </p>
          </article>
        </div>
      </section>

      <p className="prediction-note">
        These predictions are analytical
        estimates rather than official
        Formula 1 results. Actual race
        performance can be affected by
        weather, tyre strategy, pit stops,
        safety cars, penalties, mechanical
        failures, incidents and other race
        conditions.
      </p>
    </main>
  );
}

export default PredictionsDetails;