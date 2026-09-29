import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import Statistics from "./Statistics";
import { fetchRaces, fetchRaceStatistics } from "../../data/f1Data";

vi.mock("../../data/f1Data", () => ({
  fetchRaces: vi.fn(),
  fetchRaceStatistics: vi.fn(),
}));

vi.mock("../../data/circuitImages", () => ({
  getCircuitImage: vi.fn((country: string) => country === "Australia" ? "/aus.png" : "/gb.png"),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const races = [
  {
    grandPrixId: "AUS",
    seasonId: "2025",
    round: 1,
    name: "Australian Grand Prix",
    circuitName: "Albert Park",
    locality: "Melbourne",
    country: "Australia",
    date: "2025-03-16",
    hasSprint: false,
    hasResults: true,
  },
  {
    grandPrixId: "GBR",
    seasonId: "2025",
    round: 12,
    name: "British Grand Prix",
    circuitName: "Silverstone",
    locality: "Silverstone",
    country: "United Kingdom",
    date: "2025-07-06",
    hasSprint: false,
    hasResults: true,
  },
];

const ausStats = {
  grandPrixId: "AUS",
  sessionId: "2025_R1_RACE",
  totalLaps: 58,
  fastestLapDriverId: "nor",
  fastestLapDriverName: "Lando Norris",
  fastestLapNumber: 55,
  fastestLapTimeMs: 81234,
  fastestLapTime: "1:21.234",
  pitStops: 22,
  overtakes: 31,
  retirements: 3,
  dnfs: 3,
  classification: [
    { position: 1, driverId: "nor", driverName: "Lando Norris", constructorId: "MCL", constructorName: "McLaren", laps: 58, pitStops: 1, gapToWinnerMs: 0 },
    { position: 2, driverId: "pia", driverName: "Oscar Piastri", constructorId: "MCL", constructorName: "McLaren", laps: 58, pitStops: 1, gapToWinnerMs: 2000 },
    { position: 3, driverId: "ver", driverName: "Max Verstappen", constructorId: "RBR", constructorName: "Red Bull Racing", laps: 58, pitStops: 2, gapToWinnerMs: 5000 },
  ],
};

const gbrStats = {
  ...ausStats,
  grandPrixId: "GBR",
  sessionId: "2025_R12_RACE",
  totalLaps: 52,
  fastestLapDriverName: "Oscar Piastri",
  fastestLapTime: "1:28.000",
  classification: [
    { position: 1, driverId: "pia", driverName: "Oscar Piastri", constructorId: "MCL", constructorName: "McLaren", laps: 52, pitStops: 1, gapToWinnerMs: 0 },
  ],
};

describe("Statistics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetchRaces).mockResolvedValue(races);
    vi.mocked(fetchRaceStatistics).mockResolvedValue(ausStats);
  });

  test("loads default race statistics and renders rankings", async () => {
    render(<Statistics />);
    expect(screen.getByText("Loading statistics...")).toBeInTheDocument();

    expect((await screen.findAllByText("Australian Grand Prix")).length).toBeGreaterThan(0);
    expect(screen.getByText("58")).toBeInTheDocument();
    expect(screen.getByText("1:21.234")).toBeInTheDocument();
    expect(screen.getByText("Lando Norris")).toBeInTheDocument();
    expect(screen.getByText("2 finishes")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Australian Grand Prix circuit layout" })).toBeInTheDocument();
  });

  test("loads statistics for a newly selected race", async () => {
    vi.mocked(fetchRaceStatistics)
      .mockResolvedValueOnce(ausStats)
      .mockResolvedValueOnce(gbrStats);

    render(<Statistics />);
    await screen.findAllByText("Australian Grand Prix");

    fireEvent.change(screen.getByLabelText("Select Race"), { target: { value: "GBR" } });

    expect((await screen.findAllByText("British Grand Prix")).length).toBeGreaterThan(0);
    await waitFor(() => expect(fetchRaceStatistics).toHaveBeenLastCalledWith("GBR"));
    expect(screen.getByText("52")).toBeInTheDocument();
  });

  test("shows a race statistics error when changing race fails", async () => {
    vi.mocked(fetchRaceStatistics)
      .mockResolvedValueOnce(ausStats)
      .mockRejectedValueOnce(new Error("missing"));

    render(<Statistics />);
    await screen.findAllByText("Australian Grand Prix");

    fireEvent.change(screen.getByLabelText("Select Race"), { target: { value: "GBR" } });

    expect(await screen.findByText("Statistics are not available for this race.")).toBeInTheDocument();
    expect(screen.getByText("Race statistics are currently unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Driver results are currently unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Constructor results are currently unavailable.")).toBeInTheDocument();
  });

  test("shows top-level error when races cannot be loaded", async () => {
    vi.mocked(fetchRaces).mockRejectedValue(new Error("network"));
    render(<Statistics />);
    expect(await screen.findByText("Failed to load Formula 1 statistics.")).toBeInTheDocument();
  });
});
