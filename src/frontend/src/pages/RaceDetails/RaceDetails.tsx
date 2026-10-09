import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import StatCard from "../../components/StatCard";
import RaceTimeline from "../../components/RaceTimeline";
import { getCircuitImage } from "../../data/circuitImages";
import {
  fetchRace,
  fetchRaceStatistics,
  fetchRaceEvents,
  millisecondsToGap,
  type RaceDetail,
  type RaceStatistics,
  type RaceEvent,
} from "../../data/f1Data";

function RaceDetails() {
  const { id } = useParams();
  const [race, setRace] = useState<RaceDetail | null>(null);
  const [statistics, setStatistics] = useState<RaceStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<RaceEvent[]>([]);
 

  useEffect(() => {
    const loadRace = async () => {
      if (!id) {
        setError("Race not found.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const raceData = await fetchRace(id);
        setRace(raceData);

        const raceEvents = await fetchRaceEvents(id);
        setEvents(raceEvents);


        if (raceData.hasResults) {
          setStatistics(await fetchRaceStatistics(id));
        } else {
          setStatistics(null);
        }
      } catch (err) {
        console.error("Failed to load race:", err);
        setError("Failed to load race details from the API.");
      } finally {
        setLoading(false);
      }
    };

    void loadRace();
  }, [id]);

  if (loading) {
    return (
      <main>
        <h1>Race Details</h1>
        <p>Loading race...</p>
      </main>
    );
  }

  if (error || !race) {
    return (
      <main>
        <h1>Race not found</h1>
        <p style={{ color: "red" }}>{error}</p>
      </main>
    );
  }

  const circuitImage = getCircuitImage(race.country);

  // Imported races can provide a fastest lap in statistics without a matching
  // FASTEST_LAP_SET event. Add a display entry from that existing API data.
  const timelineEvents = [...events];
  if (
    statistics?.fastestLapDriverId &&
    typeof statistics.fastestLapTimeMs === "number" &&
    Number.isFinite(statistics.fastestLapTimeMs) &&
    statistics.fastestLapTimeMs > 0
  ) {
    const driverId = statistics.fastestLapDriverId;
    const lapNumber = statistics.fastestLapNumber;
    const timeMs = statistics.fastestLapTimeMs;
    const matchingIndex = timelineEvents.findIndex((event) =>
      event.type === "FASTEST_LAP_SET" &&
      event.sessionId === statistics.sessionId &&
      event.driverId?.toUpperCase() === driverId.toUpperCase() &&
      (lapNumber === null || event.lapNumber === undefined || event.lapNumber === lapNumber) &&
      (event.payload.lap_time_ms == null || event.payload.lap_time_ms === timeMs)
    );

    if (matchingIndex === -1) {
      timelineEvents.push({
        eventId: `race-summary:${statistics.sessionId}:fastest-lap`,
        sessionId: statistics.sessionId,
        type: "FASTEST_LAP_SET",
        driverId,
        lapNumber: lapNumber ?? undefined,
        timestamp: null,
        payload: {
          lap_time_ms: timeMs,
          driver_name: statistics.fastestLapDriverName,
          source: "race_statistics",
        },
      });
    } else {
      // Fill missing display details on an existing event, preserving its ID,
      // timestamp and other payload fields rather than showing it twice.
      const event = timelineEvents[matchingIndex];
      timelineEvents[matchingIndex] = {
        ...event,
        lapNumber: event.lapNumber ?? lapNumber ?? undefined,
        payload: {
          ...event.payload,
          lap_time_ms: event.payload.lap_time_ms ?? timeMs,
          driver_name: statistics.fastestLapDriverName,
        },
      };
    }
  }


return (
  <main>
    <section className="race-detail-header">
      <div className="race-detail-info">
        <p className="race-round">
          Round {race.round}
        </p>

        <h1>{race.name}</h1>

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


    {statistics ? (
      <>
        {/* =====================================================
            SUMMARY STATS
            ===================================================== */}

        <section className="stats-grid">
          <StatCard
            title="Format"
            value={
              race.hasSprint
                ? "Sprint Weekend"
                : "Standard Weekend"
            }
          />

          <StatCard
            title="Fastest Lap"
            value={statistics.fastestLapTime}
          />

          <StatCard
            title="DNFs"
            value={String(statistics.dnfs)}
          />

          <StatCard
            title="Pit Stops"
            value={String(statistics.pitStops)}
          />
        </section>

        {/* =====================================================
            CLASSIFICATION + OVERVIEW
            ===================================================== */}

        <section className="race-details-grid">
          <article className="race-detail-card race-classification-card">
            <div className="race-results-heading">
              <div>
                <p className="race-results-label">
                  Full Classification
                </p>

                <h2>Race Results</h2>
              </div>

              <span className="race-results-count">
                {statistics.classification.length} Drivers
              </span>
            </div>

            <div className="race-results-table">
              <div className="race-results-row race-results-header">
                <span>Pos</span>
                <span>Driver</span>
                <span>Constructor</span>
                <span>Laps</span>
                <span>Pit Stops</span>
                <span>Gap</span>
              </div>

              {statistics.classification.map(
                (result) => (
                  <div
                    key={result.driverId}
                    className={`race-results-row ${
                      result.position <= 3
                        ? `race-position-${result.position}`
                        : result.position <= 10
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
                      {result.constructorName}
                    </span>

                    <span>
                      {result.laps}
                    </span>

                    <span>
                      {result.pitStops}
                    </span>

                    <span className="race-result-gap">
                      {millisecondsToGap(
                        result.gapToWinnerMs
                      )}
                    </span>
                  </div>
                )
              )}
            </div>
          </article>

          <article className="race-detail-card">
            <h2>Race Overview</h2>

            <dl className="performance-list">
              <div>
                <dt>Total Laps</dt>

                <dd>
                  {statistics.totalLaps ??
                    "Not available"}
                </dd>
              </div>

              <div>
                <dt>Fastest Lap</dt>

                <dd>
                  {statistics.fastestLapDriverName}
                  {" — "}
                  {statistics.fastestLapTime}
                </dd>
              </div>

              <div>
                <dt>Fastest Lap Number</dt>

                <dd>
                  {statistics.fastestLapNumber ===
                  null
                    ? "Not available"
                    : `Lap ${statistics.fastestLapNumber}`}
                </dd>
              </div>

              <div>
                <dt>Overtakes Recorded</dt>

                <dd>
                  {statistics.overtakes}
                </dd>
              </div>

              <div>
                <dt>Pit Stops Recorded</dt>

                <dd>
                  {statistics.pitStops}
                </dd>
              </div>

              <div>
                <dt>Retirements Recorded</dt>

                <dd>
                  {statistics.retirements}
                </dd>
              </div>
            </dl>
          </article>
        </section>

        {/* =====================================================
            RACE EVENT TIMELINE
            ===================================================== */}

        <RaceTimeline
          key={race.grandPrixId}
          events={timelineEvents}
          totalLaps={statistics.totalLaps}
          classification={statistics.classification}
        />

        {/* =====================================================
            EVENT DATA SUMMARY
            ===================================================== */}

        <section className="race-chart-section">
          <h2>Event Data Summary</h2>

          <article className="race-detail-card">
            <p>
              These statistics are derived by
              the backend from the race lap and
              event data.
            </p>

            <p>
              Session ID:{" "}
              <strong>
                {statistics.sessionId}
              </strong>
            </p>
          </article>
        </section>
      </>
    ) : (
      <>
        {/* =====================================================
            NO RACE DATA
            ===================================================== */}

        <section className="stats-grid">
          <StatCard
            title="Format"
            value={
              race.hasSprint
                ? "Sprint Weekend"
                : "Standard Weekend"
            }
          />

          <StatCard
            title="Fastest Lap"
            value="Not available"
          />

          <StatCard
            title="DNFs"
            value="Not available"
          />

          <StatCard
            title="Pit Stops"
            value="Not available"
          />
        </section>

        <section className="race-details-grid">
          <article className="race-detail-card">
            <h2>Race Results</h2>

            <p>
              Detailed event data is not
              currently available for this race.
            </p>
          </article>

          <article className="race-detail-card">
            <h2>Race Overview</h2>

            <p>
              Race statistics will be available
              when event data is added.
            </p>
          </article>
        </section>
      </>
    )}
  </main>
);
}

export default RaceDetails;
