import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import DriverDetails from "./DriverDetails";
import {
  fetchDriver,
  fetchDriverStatistics,
  type Driver,
  type DriverStatistics,
} from "../../data/f1Data";

vi.mock("../../data/f1Data", async () => {
  const actual = await vi.importActual<typeof import("../../data/f1Data")>(
    "../../data/f1Data"
  );

  return {
    ...actual,
    fetchDriver: vi.fn(),
    fetchDriverStatistics: vi.fn(),
  };
});

const driver: Driver = {
  driverId: "ver",
  number: 1,
  name: "Max Verstappen",
  team: "Red Bull Racing",
  constructorId: "RBR",
  nationality: "NED",
  dateOfBirth: "1997-09-30",
};

const baseStatistics: DriverStatistics = {
  driverId: "ver",
  season: "2025",
  racesEntered: 20,
  wins: 8,
  podiums: 14,
  dnfCount: 1,
  dnfRate: 0.05,
  fastestLaps: 5,
  averageFinishPosition: 2.4,
  averageRacePaceMs: 92481,
  points: 400,
  positionsGainedLostAvg: 1.2,
};

function renderDriverDetails(id?: string) {
  const path = id ? `/drivers/${id}` : "/drivers";
  const routePath = id ? "/drivers/:id" : "/drivers";

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={<DriverDetails />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("DriverDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders driver info and statistics on success", async () => {
    vi.mocked(fetchDriver).mockResolvedValue(driver);
    vi.mocked(fetchDriverStatistics).mockResolvedValue(baseStatistics);

    renderDriverDetails("ver");

    expect(
      await screen.findByRole("heading", { name: "Max Verstappen" })
    ).toBeInTheDocument();

    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("Points").nextSibling).toHaveTextContent("400");

    expect(fetchDriver).toHaveBeenCalledWith("ver");
    expect(fetchDriverStatistics).toHaveBeenCalledWith("ver", "2025");
  });

  test("shows Not available for null average finish and positions gained/lost", async () => {
    vi.mocked(fetchDriver).mockResolvedValue(driver);
    vi.mocked(fetchDriverStatistics).mockResolvedValue({
      ...baseStatistics,
      averageFinishPosition: null,
      positionsGainedLostAvg: null,
    });

    renderDriverDetails("ver");

    await screen.findByRole("heading", { name: "Max Verstappen" });

    const notAvailable = screen.getAllByText("Not available");
    expect(notAvailable.length).toBeGreaterThanOrEqual(2);
  });

  test("renders a zero average finish and positions gained/lost, distinct from null", async () => {
    vi.mocked(fetchDriver).mockResolvedValue(driver);
    vi.mocked(fetchDriverStatistics).mockResolvedValue({
      ...baseStatistics,
      averageFinishPosition: 0,
      positionsGainedLostAvg: 0,
    });

    renderDriverDetails("ver");

    await screen.findByRole("heading", { name: "Max Verstappen" });

    expect(screen.getByText("Average Finish").nextSibling).toHaveTextContent(
      "0"
    );

    expect(
      screen.getByText("Positions Gained/Lost").nextSibling
    ).toHaveTextContent("0");

    expect(screen.queryByText("Not available")).not.toBeInTheDocument();
  });

  test("shows Not available for a null average race pace", async () => {
    vi.mocked(fetchDriver).mockResolvedValue(driver);
    vi.mocked(fetchDriverStatistics).mockResolvedValue({
      ...baseStatistics,
      averageRacePaceMs: null,
    });

    renderDriverDetails("ver");

    await screen.findByRole("heading", { name: "Max Verstappen" });

    expect(
      screen.getByText("Average Race Pace").nextSibling
    ).toHaveTextContent("Not available");
  });

  test("formats a non-null average race pace with millisecondsToLapTime", async () => {
    vi.mocked(fetchDriver).mockResolvedValue(driver);
    vi.mocked(fetchDriverStatistics).mockResolvedValue({
      ...baseStatistics,
      averageRacePaceMs: 92481,
    });

    renderDriverDetails("ver");

    await screen.findByRole("heading", { name: "Max Verstappen" });

    expect(
      screen.getByText("Average Race Pace").nextSibling
    ).toHaveTextContent("1:32.481");
  });

  test("shows Not available for a null DNF rate", async () => {
    vi.mocked(fetchDriver).mockResolvedValue(driver);
    vi.mocked(fetchDriverStatistics).mockResolvedValue({
      ...baseStatistics,
      dnfRate: null,
    });

    renderDriverDetails("ver");

    await screen.findByRole("heading", { name: "Max Verstappen" });

    expect(screen.getByText("DNF Rate").nextSibling).toHaveTextContent(
      "Not available"
    );
  });

  test("formats a non-null DNF rate as a percentage", async () => {
    vi.mocked(fetchDriver).mockResolvedValue(driver);
    vi.mocked(fetchDriverStatistics).mockResolvedValue({
      ...baseStatistics,
      dnfRate: 0.25,
    });

    renderDriverDetails("ver");

    await screen.findByRole("heading", { name: "Max Verstappen" });

    expect(screen.getByText("DNF Rate").nextSibling).toHaveTextContent(
      "25.0%"
    );
  });

  test("renders season points in the Points card", async () => {
    vi.mocked(fetchDriver).mockResolvedValue(driver);
    vi.mocked(fetchDriverStatistics).mockResolvedValue({
      ...baseStatistics,
      points: 381,
    });

    renderDriverDetails("ver");

    await screen.findByRole("heading", { name: "Max Verstappen" });

    expect(screen.getByText("Points").nextSibling).toHaveTextContent("381");
  });

  test("shows Not available for null points", async () => {
    vi.mocked(fetchDriver).mockResolvedValue(driver);
    vi.mocked(fetchDriverStatistics).mockResolvedValue({
      ...baseStatistics,
      points: null,
    });

    renderDriverDetails("ver");

    await screen.findByRole("heading", { name: "Max Verstappen" });

    expect(screen.getByText("Points").nextSibling).toHaveTextContent(
      "Not available"
    );
  });

  test("renders zero points as 0, distinct from null", async () => {
    vi.mocked(fetchDriver).mockResolvedValue(driver);
    vi.mocked(fetchDriverStatistics).mockResolvedValue({
      ...baseStatistics,
      points: 0,
    });

    renderDriverDetails("ver");

    await screen.findByRole("heading", { name: "Max Verstappen" });

    expect(screen.getByText("Points").nextSibling).toHaveTextContent("0");
    expect(screen.queryByText("Not available")).not.toBeInTheDocument();
  });

  test("renders fractional points without rounding", async () => {
    vi.mocked(fetchDriver).mockResolvedValue(driver);
    vi.mocked(fetchDriverStatistics).mockResolvedValue({
      ...baseStatistics,
      points: 12.5,
    });

    renderDriverDetails("ver");

    await screen.findByRole("heading", { name: "Max Verstappen" });

    expect(screen.getByText("Points").nextSibling).toHaveTextContent("12.5");
  });

  test("shows Driver not found without fetching when no id is provided", async () => {
    renderDriverDetails();

    expect(
      await screen.findByRole("heading", { name: "Driver not found" })
    ).toBeInTheDocument();

    expect(screen.getByText("Driver not found.")).toBeInTheDocument();
    expect(fetchDriver).not.toHaveBeenCalled();
    expect(fetchDriverStatistics).not.toHaveBeenCalled();
  });

  test("shows an error when fetching fails", async () => {
    vi.mocked(fetchDriver).mockRejectedValue(new Error("boom"));
    vi.mocked(fetchDriverStatistics).mockResolvedValue(baseStatistics);

    renderDriverDetails("ver");

    expect(
      await screen.findByRole("heading", { name: "Driver not found" })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Failed to load driver details from the API.")
    ).toBeInTheDocument();
  });
});
