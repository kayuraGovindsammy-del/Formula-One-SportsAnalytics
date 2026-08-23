import { useState } from "react";

import { useAuth } from "../../auth/useAuth";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "https://f1-sport-analytics-api-production.up.railway.app/api/v1";

type EventType =
  | "SESSION_START"
  | "SESSION_END"
  | "LAP_COMPLETED"
  | "PIT_STOP"
  | "POSITION_CHANGE"
  | "PENALTY_ISSUED"
  | "RETIREMENT"
  | "FASTEST_LAP_SET";

type PenaltyType =
  | "TIME"
  | "GRID_DROP"
  | "DISQUALIFICATION";

function SubmitData() {
  const { user } = useAuth();

  // Common event fields
  const [sessionId, setSessionId] = useState("");
  const [driverId, setDriverId] = useState("");

  const [eventType, setEventType] =
    useState<EventType>("LAP_COMPLETED");

  const [lapNumber, setLapNumber] = useState("");
  const [timestamp, setTimestamp] = useState("");

  // LAP_COMPLETED / FASTEST_LAP_SET
  // User enters M:SS.mmm
  const [lapTime, setLapTime] = useState("");

  const [position, setPosition] = useState("");
  const [isPitLap, setIsPitLap] = useState(false);
  const [isValid, setIsValid] = useState(true);

  // PIT_STOP
  // User enters seconds, e.g. 2.340
  const [pitStopSeconds, setPitStopSeconds] =
    useState("");

  const [tyreIn, setTyreIn] = useState("");
  const [tyreOut, setTyreOut] = useState("");

  // POSITION_CHANGE
  const [overtakenDriverId, setOvertakenDriverId] =
    useState("");

  const [positionBefore, setPositionBefore] =
    useState("");

  const [positionAfter, setPositionAfter] =
    useState("");

  // PENALTY_ISSUED
  const [penaltyType, setPenaltyType] =
    useState<PenaltyType>("TIME");

  // User enters seconds, e.g. 5
  const [penaltySeconds, setPenaltySeconds] =
    useState("");

  const [penaltyReason, setPenaltyReason] =
    useState("");

  // RETIREMENT
  const [retirementReason, setRetirementReason] =
    useState("");

  // Messages
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const requiresDriver =
    eventType !== "SESSION_START" &&
    eventType !== "SESSION_END";

  const requiresLapNumber =
    eventType === "LAP_COMPLETED" ||
    eventType === "PIT_STOP" ||
    eventType === "POSITION_CHANGE" ||
    eventType === "PENALTY_ISSUED" ||
    eventType === "RETIREMENT" ||
    eventType === "FASTEST_LAP_SET";

  // Converts:
  // 1:32.481 -> 92481 ms
  // 0:59.500 -> 59500 ms
  const lapTimeToMilliseconds = (
    value: string
  ): number | null => {
    const trimmed = value.trim();

    const match = trimmed.match(
      /^(\d+):([0-5]\d)\.(\d{3})$/
    );

    if (!match) {
      return null;
    }

    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const milliseconds = Number(match[3]);

    return (
      minutes * 60 * 1000 +
      seconds * 1000 +
      milliseconds
    );
  };

  // Converts:
  // 2.340 -> 2340 ms
  // 5 -> 5000 ms
  const secondsToMilliseconds = (
    value: string
  ): number | null => {
    const seconds = Number(value);

    if (
      value.trim() === "" ||
      Number.isNaN(seconds) ||
      seconds <= 0
    ) {
      return null;
    }

    return Math.round(seconds * 1000);
  };

  const createEventId = () => {
    if (
      typeof crypto !== "undefined" &&
      crypto.randomUUID
    ) {
      return `evt_${crypto.randomUUID()}`;
    }

    return `evt_${Date.now()}`;
  };

  const resetPayloadFields = () => {
    setDriverId("");
    setLapNumber("");

    setLapTime("");
    setPosition("");
    setIsPitLap(false);
    setIsValid(true);

    setPitStopSeconds("");
    setTyreIn("");
    setTyreOut("");

    setOvertakenDriverId("");
    setPositionBefore("");
    setPositionAfter("");

    setPenaltyType("TIME");
    setPenaltySeconds("");
    setPenaltyReason("");

    setRetirementReason("");
  };

  const handleEventTypeChange = (
    newType: EventType
  ) => {
    setEventType(newType);

    resetPayloadFields();

    setError("");
    setMessage("");
  };

  const validateForm = (): string | null => {
    if (!sessionId.trim()) {
      return "Session ID is required.";
    }

    if (!timestamp) {
      return "Event timestamp is required.";
    }

    if (requiresDriver && !driverId.trim()) {
      return "Driver ID is required for this event type.";
    }

    if (requiresLapNumber) {
      const lap = Number(lapNumber);

      if (
        !lapNumber ||
        !Number.isInteger(lap) ||
        lap <= 0
      ) {
        return "Lap number must be a positive whole number.";
      }
    }

    if (eventType === "LAP_COMPLETED") {
      const lapTimeMs =
        lapTimeToMilliseconds(lapTime);

      if (lapTimeMs === null) {
        return "Lap time must use the format M:SS.mmm, for example 1:32.481.";
      }

      const currentPosition = Number(position);

      if (
        !position ||
        !Number.isInteger(currentPosition) ||
        currentPosition <= 0
      ) {
        return "Position must be a positive whole number.";
      }
    }

    if (eventType === "PIT_STOP") {
      const durationMs =
        secondsToMilliseconds(pitStopSeconds);

      if (durationMs === null) {
        return "Pit stop duration must be a positive number of seconds, for example 2.340.";
      }
    }

    if (eventType === "POSITION_CHANGE") {
      if (!overtakenDriverId.trim()) {
        return "Overtaken Driver ID is required.";
      }

      const before = Number(positionBefore);
      const after = Number(positionAfter);

      if (
        !positionBefore ||
        !Number.isInteger(before) ||
        before <= 0
      ) {
        return "Position before must be a positive whole number.";
      }

      if (
        !positionAfter ||
        !Number.isInteger(after) ||
        after <= 0
      ) {
        return "Position after must be a positive whole number.";
      }

      if (before === after) {
        return "Position before and position after cannot be the same.";
      }
    }

    if (eventType === "PENALTY_ISSUED") {
      if (!penaltyReason.trim()) {
        return "Penalty reason is required.";
      }

      if (penaltyType === "TIME") {
        const durationMs =
          secondsToMilliseconds(penaltySeconds);

        if (durationMs === null) {
          return "Time penalty must be a positive number of seconds, for example 5.";
        }
      }
    }

    if (
      eventType === "RETIREMENT" &&
      !retirementReason.trim()
    ) {
      return "Retirement reason is required.";
    }

    if (eventType === "FASTEST_LAP_SET") {
      const lapTimeMs =
        lapTimeToMilliseconds(lapTime);

      if (lapTimeMs === null) {
        return "Fastest lap time must use the format M:SS.mmm, for example 1:44.861.";
      }
    }

    return null;
  };

  const buildPayload = () => {
    switch (eventType) {
      case "LAP_COMPLETED":
        return {
          lap_time_ms:
            lapTimeToMilliseconds(lapTime),
          position: Number(position),
          is_pit_lap: isPitLap,
          is_valid: isValid,
        };

      case "PIT_STOP":
        return {
          duration_ms:
            secondsToMilliseconds(
              pitStopSeconds
            ),
          ...(tyreIn.trim()
            ? {
                tyre_in:
                  tyreIn.trim().toLowerCase(),
              }
            : {}),
          ...(tyreOut.trim()
            ? {
                tyre_out:
                  tyreOut.trim().toLowerCase(),
              }
            : {}),
        };

      case "POSITION_CHANGE":
        return {
          overtaken_driver_id:
            overtakenDriverId
              .trim()
              .toUpperCase(),
          position_before:
            Number(positionBefore),
          position_after:
            Number(positionAfter),
        };

      case "PENALTY_ISSUED":
        return {
          penalty_type: penaltyType,

          ...(penaltyType === "TIME"
            ? {
                duration_ms:
                  secondsToMilliseconds(
                    penaltySeconds
                  ),
              }
            : {}),

          reason: penaltyReason.trim(),
        };

      case "RETIREMENT":
        return {
          reason: retirementReason.trim(),
        };

      case "FASTEST_LAP_SET":
        return {
          lap_time_ms:
            lapTimeToMilliseconds(lapTime),
        };

      case "SESSION_START":
      case "SESSION_END":
        return {};

      default:
        return {};
    }
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!user) {
      setError("You must be signed in.");
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);

      const eventData = {
        event_id: createEventId(),

        session_id: sessionId.trim(),

        ...(requiresDriver
          ? {
              driver_id: driverId
                .trim()
                .toUpperCase(),
            }
          : {}),

        type: eventType,

        ...(requiresLapNumber
          ? {
              lap_number:
                Number(lapNumber),
            }
          : {}),

        timestamp:
          new Date(timestamp).toISOString(),

        payload: buildPayload(),
      };

      const token = await user.getIdToken();

      const response = await fetch(
        `${API_BASE_URL}/submissions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            event: eventData,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error?.message ||
            result?.error ||
            "Failed to submit event data."
        );
      }

      console.log("Submission created:", result);

      setMessage(
        "Event submitted successfully and is pending review."
      );

      setSessionId("");
      setTimestamp("");

      resetPayloadFields();
    } catch (err) {
      console.error(
        "Submission error:",
        err
      );

      setError(
        "Failed to submit event data. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    display: "block",
    width: "100%",
    padding: "10px",
    marginTop: "8px",
    boxSizing: "border-box" as const,
  };

  const sectionStyle = {
    border: "1px solid #444",
    borderRadius: "10px",
    padding: "20px",
    marginTop: "25px",
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "30px",
      }}
    >
      <h1>Submit F1 Event Data</h1>

      <p>
        Submit Formula 1 event data using
        the project's event schema.
      </p>

      <form onSubmit={handleSubmit}>
        {/* EVENT INFORMATION */}

        <div style={sectionStyle}>
          <h2>Event Information</h2>

          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="sessionId">
              Session ID *
            </label>

            <input
              id="sessionId"
              type="text"
              value={sessionId}
              onChange={(event) =>
                setSessionId(
                  event.target.value
                )
              }
              placeholder="e.g. 2025_R13_RACE"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="eventType">
              Event Type *
            </label>

            <select
              id="eventType"
              value={eventType}
              onChange={(event) =>
                handleEventTypeChange(
                  event.target
                    .value as EventType
                )
              }
              style={inputStyle}
            >
              <option value="SESSION_START">
                Session Start
              </option>

              <option value="SESSION_END">
                Session End
              </option>

              <option value="LAP_COMPLETED">
                Lap Completed
              </option>

              <option value="PIT_STOP">
                Pit Stop
              </option>

              <option value="POSITION_CHANGE">
                Position Change
              </option>

              <option value="PENALTY_ISSUED">
                Penalty Issued
              </option>

              <option value="RETIREMENT">
                Retirement
              </option>

              <option value="FASTEST_LAP_SET">
                Fastest Lap Set
              </option>
            </select>
          </div>

          {requiresDriver && (
            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="driverId">
                Driver ID *
              </label>

              <input
                id="driverId"
                type="text"
                value={driverId}
                onChange={(event) =>
                  setDriverId(
                    event.target.value
                  )
                }
                placeholder="e.g. PIA"
                maxLength={3}
                style={inputStyle}
              />
            </div>
          )}

          {requiresLapNumber && (
            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="lapNumber">
                Lap Number *
              </label>

              <input
                id="lapNumber"
                type="number"
                min="1"
                value={lapNumber}
                onChange={(event) =>
                  setLapNumber(
                    event.target.value
                  )
                }
                placeholder="e.g. 5"
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="timestamp">
              Event Timestamp *
            </label>

            <input
              id="timestamp"
              type="datetime-local"
              value={timestamp}
              onChange={(event) =>
                setTimestamp(
                  event.target.value
                )
              }
              style={inputStyle}
            />
          </div>
        </div>

        {/* LAP COMPLETED */}

        {eventType === "LAP_COMPLETED" && (
          <div style={sectionStyle}>
            <h2>Lap Details</h2>

            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="lapTime">
                Lap Time *
              </label>

              <input
                id="lapTime"
                type="text"
                value={lapTime}
                onChange={(event) =>
                  setLapTime(
                    event.target.value
                  )
                }
                placeholder="e.g. 1:32.481"
                style={inputStyle}
              />

              <small>
                Format: minutes:seconds.milliseconds
              </small>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="position">
                Position After Lap *
              </label>

              <input
                id="position"
                type="number"
                min="1"
                value={position}
                onChange={(event) =>
                  setPosition(
                    event.target.value
                  )
                }
                placeholder="e.g. 1"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label>
                <input
                  type="checkbox"
                  checked={isPitLap}
                  onChange={(event) =>
                    setIsPitLap(
                      event.target.checked
                    )
                  }
                />{" "}
                Pit Lap
              </label>
            </div>

            <div>
              <label>
                <input
                  type="checkbox"
                  checked={isValid}
                  onChange={(event) =>
                    setIsValid(
                      event.target.checked
                    )
                  }
                />{" "}
                Valid Lap
              </label>
            </div>
          </div>
        )}

        {/* PIT STOP */}

        {eventType === "PIT_STOP" && (
          <div style={sectionStyle}>
            <h2>Pit Stop Details</h2>

            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="pitStopSeconds">
                Pit Stop Duration (seconds) *
              </label>

              <input
                id="pitStopSeconds"
                type="number"
                min="0"
                step="0.001"
                value={pitStopSeconds}
                onChange={(event) =>
                  setPitStopSeconds(
                    event.target.value
                  )
                }
                placeholder="e.g. 2.340"
                style={inputStyle}
              />

              <small>
                Example: 2.340 seconds
              </small>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="tyreIn">
                Tyre In
              </label>

              <select
                id="tyreIn"
                value={tyreIn}
                onChange={(event) =>
                  setTyreIn(
                    event.target.value
                  )
                }
                style={inputStyle}
              >
                <option value="">
                  Not specified
                </option>
                <option value="soft">
                  Soft
                </option>
                <option value="medium">
                  Medium
                </option>
                <option value="hard">
                  Hard
                </option>
                <option value="intermediate">
                  Intermediate
                </option>
                <option value="wet">
                  Wet
                </option>
              </select>
            </div>

            <div>
              <label htmlFor="tyreOut">
                Tyre Out
              </label>

              <select
                id="tyreOut"
                value={tyreOut}
                onChange={(event) =>
                  setTyreOut(
                    event.target.value
                  )
                }
                style={inputStyle}
              >
                <option value="">
                  Not specified
                </option>
                <option value="soft">
                  Soft
                </option>
                <option value="medium">
                  Medium
                </option>
                <option value="hard">
                  Hard
                </option>
                <option value="intermediate">
                  Intermediate
                </option>
                <option value="wet">
                  Wet
                </option>
              </select>
            </div>
          </div>
        )}

        {/* POSITION CHANGE */}

        {eventType === "POSITION_CHANGE" && (
          <div style={sectionStyle}>
            <h2>Position Change Details</h2>

            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="overtakenDriver">
                Overtaken Driver ID *
              </label>

              <input
                id="overtakenDriver"
                type="text"
                maxLength={3}
                value={overtakenDriverId}
                onChange={(event) =>
                  setOvertakenDriverId(
                    event.target.value
                  )
                }
                placeholder="e.g. NOR"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="positionBefore">
                Position Before *
              </label>

              <input
                id="positionBefore"
                type="number"
                min="1"
                value={positionBefore}
                onChange={(event) =>
                  setPositionBefore(
                    event.target.value
                  )
                }
                placeholder="e.g. 2"
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="positionAfter">
                Position After *
              </label>

              <input
                id="positionAfter"
                type="number"
                min="1"
                value={positionAfter}
                onChange={(event) =>
                  setPositionAfter(
                    event.target.value
                  )
                }
                placeholder="e.g. 1"
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* PENALTY */}

        {eventType === "PENALTY_ISSUED" && (
          <div style={sectionStyle}>
            <h2>Penalty Details</h2>

            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="penaltyType">
                Penalty Type *
              </label>

              <select
                id="penaltyType"
                value={penaltyType}
                onChange={(event) =>
                  setPenaltyType(
                    event.target
                      .value as PenaltyType
                  )
                }
                style={inputStyle}
              >
                <option value="TIME">
                  Time Penalty
                </option>

                <option value="GRID_DROP">
                  Grid Drop
                </option>

                <option value="DISQUALIFICATION">
                  Disqualification
                </option>
              </select>
            </div>

            {penaltyType === "TIME" && (
              <div style={{ marginBottom: "20px" }}>
                <label htmlFor="penaltySeconds">
                  Penalty Duration (seconds) *
                </label>

                <input
                  id="penaltySeconds"
                  type="number"
                  min="0"
                  step="0.001"
                  value={penaltySeconds}
                  onChange={(event) =>
                    setPenaltySeconds(
                      event.target.value
                    )
                  }
                  placeholder="e.g. 5"
                  style={inputStyle}
                />
              </div>
            )}

            <div>
              <label htmlFor="penaltyReason">
                Reason *
              </label>

              <textarea
                id="penaltyReason"
                value={penaltyReason}
                onChange={(event) =>
                  setPenaltyReason(
                    event.target.value
                  )
                }
                placeholder="e.g. Track limits"
                rows={4}
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* RETIREMENT */}

        {eventType === "RETIREMENT" && (
          <div style={sectionStyle}>
            <h2>Retirement Details</h2>

            <label htmlFor="retirementReason">
              Retirement Reason *
            </label>

            <textarea
              id="retirementReason"
              value={retirementReason}
              onChange={(event) =>
                setRetirementReason(
                  event.target.value
                )
              }
              placeholder="e.g. Engine failure"
              rows={4}
              style={inputStyle}
            />
          </div>
        )}

        {/* FASTEST LAP */}

        {eventType === "FASTEST_LAP_SET" && (
          <div style={sectionStyle}>
            <h2>Fastest Lap Details</h2>

            <label htmlFor="fastestLapTime">
              Fastest Lap Time *
            </label>

            <input
              id="fastestLapTime"
              type="text"
              value={lapTime}
              onChange={(event) =>
                setLapTime(
                  event.target.value
                )
              }
              placeholder="e.g. 1:44.861"
              style={inputStyle}
            />

            <small>
              Format: minutes:seconds.milliseconds
            </small>
          </div>
        )}

        {/* SESSION BOUNDARY */}

        {(eventType === "SESSION_START" ||
          eventType === "SESSION_END") && (
          <div style={sectionStyle}>
            <h2>Session Boundary Event</h2>

            <p>
              No additional payload information is
              required for this event type.
            </p>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "25px",
              padding: "12px",
              border: "1px solid red",
              borderRadius: "6px",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {message && (
          <div
            style={{
              marginTop: "25px",
              padding: "12px",
              border: "1px solid green",
              borderRadius: "6px",
            }}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "30px",
            padding: "12px 25px",
            fontSize: "16px",
            cursor: loading
              ? "not-allowed"
              : "pointer",
          }}
        >
          {loading
            ? "Submitting Event..."
            : "Submit Event for Review"}
        </button>
      </form>
    </div>
  );
}

export default SubmitData;