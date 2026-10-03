import { useId, useState } from "react";
import {
  millisecondsToLapTime,
  type RaceEvent,
  type RaceResult,
} from "../data/f1Data";
import "./RaceTimeline.css";

const EVENT_STYLES = {
  PIT_STOP: { label: "Pit stop", plural: "Pit stops", tone: "pit", icon: "M14.5 6.5a5 5 0 0 0-6 6L3 18l3 3 5.5-5.5a5 5 0 0 0 6-6L14 13l-3-3 3.5-3.5Z" },
  POSITION_CHANGE: { label: "Position change", plural: "Positions", tone: "position", icon: "M7 19V5m-4 4 4-4 4 4m6-4v14m-4-4 4 4 4-4" },
  RETIREMENT: { label: "Retirement", plural: "Retirements", tone: "retirement", icon: "m8 3-5 5v8l5 5h8l5-5V8l-5-5H8Zm1 6 6 6m0-6-6 6" },
  FASTEST_LAP_SET: { label: "Fastest lap", plural: "Fastest laps", tone: "fastest", icon: "M9 2h6m-3 0v3m6 1 2 2M12 9v5l3 2M21 14a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
} as const;

type HighlightType = keyof typeof EVENT_STYLES;
type Highlight = RaceEvent & { type: HighlightType };
type Props = { events: RaceEvent[]; totalLaps: number | null; classification: RaceResult[] };

function isHighlight(event: RaceEvent): event is Highlight {
  return Object.prototype.hasOwnProperty.call(EVENT_STYLES, event.type);
}

function eventLap(event: RaceEvent): number | null {
  return Number.isInteger(event.lapNumber) && event.lapNumber! > 0 ? event.lapNumber! : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function EventIcon({ type }: { type: HighlightType }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={EVENT_STYLES[type].icon} />
    </svg>
  );
}

function eventDetails(event: Highlight, driverName: (id: string) => string) {
  const payload = event.payload;
  const duration = numberValue(payload.duration_ms);
  const reason = textValue(payload.reason);

  switch (event.type) {
    case "PIT_STOP": {
      const tyreIn = textValue(payload.tyre_in);
      const tyreOut = textValue(payload.tyre_out);
      return {
        detail: tyreIn && tyreOut ? `Tyres: ${tyreIn} → ${tyreOut}` : tyreOut ? `New tyres: ${tyreOut}` : "Pit stop recorded",
        metric: duration === null ? null : `${(duration / 1000).toFixed(2)}s`,
        metricLabel: "Stop duration",
      };
    }
    case "POSITION_CHANGE": {
      const before = numberValue(payload.position_before);
      const after = numberValue(payload.position_after);
      const otherDriver = textValue(payload.overtaken_driver_id);
      const gained = before !== null && after !== null && before > after;
      return {
        detail: otherDriver && gained ? `Passed ${driverName(otherDriver)}` : "Race position updated",
        metric: before && after ? `P${before} → P${after}` : null,
        metricLabel: "Race position",
      };
    }
    case "FASTEST_LAP_SET": {
      const lapTime = numberValue(payload.lap_time_ms);
      return { detail: payload.source === "race_statistics" ? "Race fastest lap" : "New fastest lap recorded", metric: lapTime === null ? null : millisecondsToLapTime(lapTime), metricLabel: "Lap time" };
    }
    case "RETIREMENT":
      return { detail: reason ?? "Retired from the race", metric: null, metricLabel: "" };
    
  }
}

export default function RaceTimeline({ events, totalLaps, classification }: Props) {
  const headingId = useId();
  const [typeFilter, setTypeFilter] = useState<HighlightType | "all">("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [lapFilter, setLapFilter] = useState("all");
  const [newestFirst, setNewestFirst] = useState(false);
  const [visibleLaps, setVisibleLaps] = useState(8);
  const highlights = events.filter(isHighlight);
  const names = new Map(classification.map((driver) => [driver.driverId.toUpperCase(), driver.driverName]));
  const driverName = (id: string) => names.get(id.toUpperCase()) ?? id;
  const drivers = [...new Set(highlights.flatMap((event) => event.driverId ? [event.driverId] : []))]
    .sort((a, b) => driverName(a).localeCompare(driverName(b)));
  const filtered = highlights.filter((event) =>
    (typeFilter === "all" || event.type === typeFilter) &&
    (driverFilter === "all" || event.driverId === driverFilter)
  );
  const byLap = new Map<number | null, Highlight[]>();
  filtered.forEach((event) => {
    const lap = eventLap(event);
    byLap.set(lap, [...(byLap.get(lap) ?? []), event]);
  });
  const lapNumbers = [...byLap.keys()].sort((a, b) => (a ?? Infinity) - (b ?? Infinity));
  const selected = filtered.filter((event) => lapFilter === "all" || String(eventLap(event)) === lapFilter);
  const displayedGroups = lapNumbers
    .filter((lap) => lapFilter === "all" || String(lap) === lapFilter)
    .sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return newestFirst ? b - a : a - b;
    });
  const lastRecordedLap = highlights.reduce((max, event) => Math.max(max, eventLap(event) ?? 0), 0);
  const knownTotal = Number.isInteger(totalLaps) && totalLaps! > 0 ? totalLaps : null;
  const overviewLaps = Math.max(knownTotal ?? 0, lastRecordedLap);
  const axisLabels = [...new Set([1, Math.round(overviewLaps / 4), Math.round(overviewLaps / 2), Math.round(overviewLaps * 3 / 4), overviewLaps])].filter((lap) => lap > 0);
  const hasFilters = typeFilter !== "all" || driverFilter !== "all" || lapFilter !== "all";

  function resetFilters() {
    setTypeFilter("all");
    setDriverFilter("all");
    setLapFilter("all");
    setVisibleLaps(8);
  }

  return (
    <section className="race-replay" aria-labelledby={headingId}>
      <div className="rr-heading">
        <div>
          <p className="rr-eyebrow"><span aria-hidden="true" /> The race, moment by moment</p>
          <h2 id={headingId}>Race Timeline</h2>
          <p className="rr-subtitle">Follow the stops, position changes and defining moments.</p>
        </div>
        <div className="rr-totals">
          <div><strong>{highlights.length}</strong><span>recorded events</span></div>
          {knownTotal !== null && <div><strong>{knownTotal}</strong><span>race laps</span></div>}
        </div>
      </div>

      {highlights.length === 0 ? (
        <div className="rr-empty"><h3>No race events yet</h3><p>Race event data is not currently available.</p></div>
      ) : (
        <>
          <div className="rr-filters" role="group" aria-label="Filter by event type">
            <button type="button" className="rr-filter" aria-pressed={typeFilter === "all"} onClick={() => { setTypeFilter("all"); setLapFilter("all"); setVisibleLaps(8); }}>
              All events <span>{highlights.length}</span>
            </button>
            {(Object.keys(EVENT_STYLES) as HighlightType[]).map((type) => (
              <button type="button" key={type} className={`rr-filter rr-${EVENT_STYLES[type].tone}`} aria-pressed={typeFilter === type} onClick={() => { setTypeFilter(type); setLapFilter("all"); setVisibleLaps(8); }}>
                <EventIcon type={type} />{EVENT_STYLES[type].plural}<span>{highlights.filter((event) => event.type === type).length}</span>
              </button>
            ))}
          </div>

          {overviewLaps > 0 && (
            <div className="rr-overview">
              <div className="rr-overview-heading"><h3>Race at a glance</h3><p>Select a highlighted lap to explore its events</p></div>
              <div className="rr-overview-scroll">
                <div className="rr-overview-inner">
                  <div className="rr-lap-strip" style={{ gridTemplateColumns: `repeat(${overviewLaps}, minmax(0, 1fr))` }}>
                    {Array.from({ length: overviewLaps }, (_, i) => {
                      const lap = i + 1;
                      const lapEvents = byLap.get(lap) ?? [];
                      const types = [...new Set(lapEvents.map((event) => event.type))];
                      return (
                        <button type="button" key={lap} className="rr-lap-marker" disabled={!lapEvents.length} aria-label={`Lap ${lap}: ${lapEvents.length} ${lapEvents.length === 1 ? "event" : "events"}`} aria-pressed={lapFilter === String(lap)} title={`Lap ${lap} · ${lapEvents.length} events`} onClick={() => { setLapFilter(lapFilter === String(lap) ? "all" : String(lap)); setVisibleLaps(8); }}>
                          {types.map((type) => <span key={type} className={`rr-${EVENT_STYLES[type].tone}`} />)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="rr-axis" aria-hidden="true">{axisLabels.map((lap) => <span key={lap}>Lap {lap}</span>)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="rr-toolbar">
            <div className="rr-selects">
              <label>Driver<select aria-label="Driver" value={driverFilter} onChange={(event) => { setDriverFilter(event.target.value); setLapFilter("all"); setVisibleLaps(8); }}><option value="all">All drivers</option>{drivers.map((id) => <option key={id} value={id}>{driverName(id)}</option>)}</select></label>
              <label>Lap<select aria-label="Lap" value={lapFilter} onChange={(event) => { setLapFilter(event.target.value); setVisibleLaps(8); }}><option value="all">All laps</option>{lapNumbers.map((lap) => <option key={String(lap)} value={String(lap)}>{lap === null ? "Lap unknown" : `Lap ${lap}`}</option>)}</select></label>
            </div>
            <button type="button" className="rr-sort" onClick={() => { setNewestFirst(!newestFirst); setVisibleLaps(8); }} aria-label={`Sort events: ${newestFirst ? "latest" : "earliest"} first`}><span aria-hidden="true">↕</span>{newestFirst ? "Latest first" : "Earliest first"}</button>
          </div>

          <div className="rr-feed-heading">
            <p role="status">{selected.length} {selected.length === 1 ? "event" : "events"}{lapFilter === "all" ? " matching selection" : lapFilter === "null" ? " · lap unknown" : ` · Lap ${lapFilter}`}</p>
            {hasFilters ? <button type="button" className="rr-clear" onClick={resetFilters}>Clear filters <span aria-hidden="true">×</span></button> : <span className="rr-feed-hint">Grouped by lap</span>}
          </div>

          {selected.length === 0 ? (
            <div className="rr-empty"><h3>No matching events</h3><p>Try another driver or event type.</p><button type="button" className="rr-more" onClick={resetFilters}>Show all events</button></div>
          ) : (
            <ol className="rr-feed" aria-label="Race events by lap">
              {displayedGroups.slice(0, visibleLaps).map((lap) => (
                <li className="rr-lap-group" key={String(lap)}>
                  <div className="rr-lap-label"><span>LAP</span><strong>{lap === null ? "?" : String(lap).padStart(2, "0")}</strong>{lap === null && <small>Unknown</small>}</div>
                  <div className="rr-lap-events">
                    {(byLap.get(lap) ?? []).map((event) => {
                      const style = EVENT_STYLES[event.type];
                      const details = eventDetails(event, driverName);
                      const timestamp = event.timestamp ? new Date(event.timestamp) : null;
                      const validTime = timestamp !== null && Number.isFinite(timestamp.getTime());
                      return (
                        <article key={event.eventId} className={`rr-event rr-${style.tone}`}>
                          <div className="rr-event-icon"><EventIcon type={event.type} /></div>
                          <div className="rr-event-content">
                            <div className="rr-event-top"><span className="rr-event-type">{style.label}</span>{validTime && <time dateTime={event.timestamp!}>{timestamp.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit" })} UTC</time>}</div>
                            <h3>{textValue(event.payload.driver_name) ?? (event.driverId ? driverName(event.driverId) : "Driver not specified")}</h3>
                            <p>{details.detail}</p>
                          </div>
                          {details.metric && <div className="rr-metric"><strong>{details.metric}</strong><span>{details.metricLabel}</span></div>}
                        </article>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {displayedGroups.length > visibleLaps && <div className="rr-pagination"><p>Showing {visibleLaps} of {displayedGroups.length} lap groups</p><button type="button" className="rr-more" onClick={() => setVisibleLaps(visibleLaps + 8)}>Show more laps <span aria-hidden="true">↓</span></button></div>}
          {selected.length > 0 && displayedGroups.length <= visibleLaps && <p className="rr-end"><span aria-hidden="true" />{hasFilters ? "All matching events shown" : "End of recorded events"}<span aria-hidden="true" /></p>}
        </>
      )}
    </section>
  );
}
