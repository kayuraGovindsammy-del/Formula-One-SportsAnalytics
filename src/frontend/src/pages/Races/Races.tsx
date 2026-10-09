import {
  useEffect,
  useState,
} from "react";

import {
  useLocation,
  useNavigationType,
  useSearchParams,
} from "react-router-dom";

import DatasetDownloads from "../../components/DatasetDownloads";
import RaceCard from "../../components/RaceCard";

import {
  fetchRaces,
  type Race,
} from "../../data/f1Data";

const SEASON = "2025";

function Races() {
  const [races, setRaces] =
    useState<Race[]>([]);

  const [searchParams, setSearchParams] =
    useSearchParams();

  const location = useLocation();

  const navigationType =
    useNavigationType();

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const searchTerm =
    searchParams.get("search") ?? "";

  const scrollStorageKey =
    `races-scroll:${location.pathname}${location.search}`;

  /*
   * Load races from API
   */
  useEffect(() => {
    const loadRaces = async () => {
      try {
        setLoading(true);
        setError("");

        const raceData =
          await fetchRaces();

        setRaces(raceData);
      } catch (err) {
        console.error(
          "Failed to load races:",
          err
        );

        setError(
          "Failed to load races from the API."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadRaces();
  }, []);

  /*
   * Continuously save the user's
   * current scroll position.
   */
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem(
        scrollStorageKey,
        String(window.scrollY)
      );
    };

    window.addEventListener(
      "scroll",
      handleScroll,
      {
        passive: true,
      }
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );
    };
  }, [scrollStorageKey]);

  /*
   * Restore the saved scroll position
   * when arriving through Back/Forward.
   */
  useEffect(() => {
    if (
      loading ||
      navigationType !== "POP"
    ) {
      return;
    }

    const savedPosition =
      sessionStorage.getItem(
        scrollStorageKey
      );

    if (!savedPosition) {
      return;
    }

    const scrollPosition =
      Number(savedPosition);

    if (
      !Number.isFinite(
        scrollPosition
      )
    ) {
      return;
    }

    const restoreScroll = () => {
      window.scrollTo(
        0,
        scrollPosition
      );
    };

    /*
     * React may render the cards before
     * images/layout have fully settled,
     * so restore more than once.
     */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoreScroll();

        setTimeout(
          restoreScroll,
          50
        );

        setTimeout(
          restoreScroll,
          150
        );
      });
    });
  }, [
    loading,
    navigationType,
    scrollStorageKey,
  ]);

  /*
   * Search races
   */
  const filteredRaces =
    races.filter((race) => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      return (
        race.name
          .toLowerCase()
          .includes(search) ||
        race.country
          .toLowerCase()
          .includes(search) ||
        race.circuitName
          .toLowerCase()
          .includes(search) ||
        race.locality
          .toLowerCase()
          .includes(search)
      );
    });

  if (loading) {
    return (
      <main>
        <h1>
          {SEASON} Races
        </h1>

        <p>
          Loading races...
        </p>
      </main>
    );
  }

  return (
    <main>
      {/* HEADER */}

      <section>
        <h1>
          {SEASON} Races
        </h1>

        <p>
          Browse races from the{" "}
          {SEASON} Formula 1 season.
        </p>

        <div className="dataset-downloads-group">
          <DatasetDownloads
            dataset="races"
            season={SEASON}
            label="calendar"
            describe
          />

          <DatasetDownloads
            dataset="results"
            season={SEASON}
            label="results"
            describe
          />
        </div>
      </section>

      {/* ERROR */}

      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}

      {/* SEARCH */}

      <section className="race-controls">
        <div className="race-search">
          <span
            className="race-search-icon"
            aria-hidden="true"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle
                cx="11"
                cy="11"
                r="8"
              />

              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>

          <input
            type="search"
            placeholder="Search races..."
            value={searchTerm}
            onChange={(event) => {
              const next =
                new URLSearchParams(
                  searchParams
                );

              const value =
                event.target.value;

              if (value) {
                next.set(
                  "search",
                  value
                );
              } else {
                next.delete(
                  "search"
                );
              }

              setSearchParams(
                next,
                {
                  replace: true,
                }
              );
            }}
            aria-label="Search races"
          />
        </div>
      </section>

      {/* RESULT COUNT */}

      <p className="results-count">
        Showing{" "}
        {filteredRaces.length} race
        {filteredRaces.length !== 1
          ? "s"
          : ""}
      </p>

      {/* RACE CARDS */}

      <section className="races-grid">
        {filteredRaces.length > 0 ? (
          filteredRaces.map(
            (race) => (
              <RaceCard
                key={
                  race.grandPrixId
                }
                grandPrixId={
                  race.grandPrixId
                }
                round={race.round}
                name={race.name}
                circuitName={
                  race.circuitName
                }
                locality={
                  race.locality
                }
                country={
                  race.country
                }
                date={race.date}
                hasSprint={
                  race.hasSprint
                }
                hasResults={
                  race.hasResults
                }
              />
            )
          )
        ) : (
          <p>
            No races match your search.
          </p>
        )}
      </section>
    </main>
  );
}

export default Races;