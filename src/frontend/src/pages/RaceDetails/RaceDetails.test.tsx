import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import RaceDetails from "./RaceDetails";
import {
  fetchRace,
  fetchRaceEvents,
  fetchRaceStatistics,
  type RaceDetail,
  type RaceStatistics,
} from "../../data/f1Data";

vi.mock("../../data/f1Data", async () => {
  const actual = await vi.importActual<typeof import("../../data/f1Data")>(
    "../../data/f1Data"
  );

  return {
    ...actual,
    fetchRace: vi.fn(),
    fetchRaceEvents: vi.fn(),
    fetchRaceStatistics: vi.fn(),
  };
});

const raceWithResults: RaceDetail = {
  grandPrixId: "gp-australia",
  seasonId: "2025",
  round: 1,
  name: "Australian Grand Prix",
  circuitName: "Albert Park Circuit",
  locality: "Melbourne",
  country: "Australia",
  date: "2025-03-16",
  hasSprint: false,
  hasResults: true,
  sessions: [],
};

const raceWithoutResults: RaceDetail = {
  ...raceWithResults,
  hasResults: false,
};

const baseStatistics: RaceStatistics = {
  grandPrixId: "gp-australia",
  sessionId: "gp-australia_race",
  totalLaps: 58,
  fastestLapDriverId: "ver",
  fastestLapDriverName: "Max Verstappen",
  fastestLapNumber: 44,
  fastestLapTimeMs: 78123,
  fastestLapTime: "1:18.123",
  pitStops: 20,
  overtakes: 12,
  retirements: 2,
  dnfs: 2,
  classification: [
    {
      position: 1,
      driverId: "ver",
      driverName: "Max Verstappen",
      constructorId: "RBR",
      constructorName: "Red Bull Racing",
      laps: 58,
      pitStops: 1,
      gapToWinnerMs: 0,
    },
    {
      position: 2,
      driverId: "lec",
      driverName: "Charles Leclerc",
      constructorId: "FER",
      constructorName: "Ferrari",
      laps: 58,
      pitStops: 2,
      gapToWinnerMs: 5321,
    },
    {
      position: 3,
      driverId: "ham",
      driverName: "Lewis Hamilton",
      constructorId: "FER",
      constructorName: "Ferrari",
      laps: 55,
      pitStops: 2,
      gapToWinnerMs: null,
    },
  ],
};

function renderRaceDetails(id?: string) {
  const path = id ? `/races/${id}` : "/races";
  const routePath = id ? "/races/:id" : "/races";

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={<RaceDetails />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RaceDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchRaceEvents).mockResolvedValue([]);
  });

  test("fetches and renders statistics when hasResults is true, formatting each gap case", async () => {
    vi.mocked(fetchRace).mockResolvedValue(raceWithResults);
    vi.mocked(fetchRaceStatistics).mockResolvedValue(baseStatistics);

    renderRaceDetails("gp-australia");

    expect(
      await screen.findByRole("heading", { name: "Australian Grand Prix" })
    ).toBeInTheDocument();

    expect(fetchRaceStatistics).toHaveBeenCalledWith("gp-australia");

    expect(screen.getByText("Winner")).toBeInTheDocument();
    expect(screen.getByText("+5.321s")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();

    expect(
  screen.getAllByText("58").length
).toBeGreaterThan(0);
    expect(
  screen.getAllByText("Lap 44").length
).toBeGreaterThan(0);
  });

  test("does not fetch statistics when hasResults is false, and shows placeholders", async () => {
    vi.mocked(fetchRace).mockResolvedValue(raceWithoutResults);

    renderRaceDetails("gp-australia");

    expect(
      await screen.findByRole("heading", { name: "Australian Grand Prix" })
    ).toBeInTheDocument();

    expect(fetchRaceStatistics).not.toHaveBeenCalled();

    expect(
      screen.getByText(
        "Detailed event data is not currently available for this race."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Race statistics will be available when event data is added."
      )
    ).toBeInTheDocument();

    const notAvailableStats = screen.getAllByText("Not available");
    expect(notAvailableStats.length).toBeGreaterThanOrEqual(3);
  });

  test("shows Not available for a null total lap count and fastest lap number", async () => {
    vi.mocked(fetchRace).mockResolvedValue(raceWithResults);
    vi.mocked(fetchRaceStatistics).mockResolvedValue({
      ...baseStatistics,
      totalLaps: null,
      fastestLapNumber: null,
    });

    renderRaceDetails("gp-australia");

    await screen.findByRole("heading", { name: "Australian Grand Prix" });

    expect(screen.getByText("Total Laps").nextSibling).toHaveTextContent(
      "Not available"
    );

    expect(
      screen.getByText("Fastest Lap Number").nextSibling
    ).toHaveTextContent("Not available");
  });

  test("shows Race not found without fetching when no id is provided", async () => {
    renderRaceDetails();

    expect(
      await screen.findByRole("heading", { name: "Race not found" })
    ).toBeInTheDocument();

    expect(screen.getByText("Race not found.")).toBeInTheDocument();
    expect(fetchRace).not.toHaveBeenCalled();
    expect(fetchRaceStatistics).not.toHaveBeenCalled();
  });

  test("shows an error when fetching fails", async () => {
    vi.mocked(fetchRace).mockRejectedValue(new Error("boom"));

    renderRaceDetails("gp-australia");

    expect(
      await screen.findByRole("heading", { name: "Race not found" })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Failed to load race details from the API.")
    ).toBeInTheDocument();
  });
});
