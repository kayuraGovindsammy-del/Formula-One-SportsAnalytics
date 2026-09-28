import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Dashboard from "./Dashboard";
import {
  fetchFeaturedRace,
  fetchSeasonSummary,
} from "../../data/f1Data";

vi.mock("../../data/f1Data", () => ({
  fetchSeasonSummary: vi.fn(),
  fetchFeaturedRace: vi.fn(),
}));

vi.mock("../../data/circuitImages", () => ({
  getCircuitImage: vi.fn(() => "/circuits/test.svg"),
}));

vi.mock("../../auth/useAuth", () => ({
  useAuth: () => ({
    role: "USER",
    submitterStatus: "none",
  }),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(fetchSeasonSummary).mockResolvedValue({
      season: "2025",
      raceCount: 24,
      driverCount: 20,
      constructorCount: 10,
    });

    vi.mocked(fetchFeaturedRace).mockResolvedValue({
      race: {
        grandPrixId: "BEL",
        round: 13,
        name: "Belgian Grand Prix",
        circuitName: "Circuit de Spa-Francorchamps",
        locality: "Stavelot",
        country: "Belgium",
        date: "2025-07-27",
        winner: "Oscar Piastri",
        fastestLapDriver: "Lando Norris",
        fastestLapTime: "1:44.861",
      },
    } as Awaited<ReturnType<typeof fetchFeaturedRace>>);
  });

  test("shows loading state", () => {
    renderDashboard();

    expect(
      screen.getByText("Loading dashboard data...")
    ).toBeInTheDocument();
  });

  test("renders season summary", async () => {
    renderDashboard();

    expect(
      await screen.findByText("2025 Season")
    ).toBeInTheDocument();

    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  test("renders dashboard navigation links", async () => {
  renderDashboard();

  await screen.findByText("2025 Season");

  expect(
    document.querySelector('a[href="/drivers"]')
  ).toBeInTheDocument();

  expect(
    document.querySelector('a[href="/races"]')
  ).toBeInTheDocument();

  expect(
    document.querySelector('a[href="/constructors"]')
  ).toBeInTheDocument();

  expect(
    document.querySelector('a[href="/statistics"]')
  ).toBeInTheDocument();
});

  test("renders featured race", async () => {
    renderDashboard();

    expect(
      await screen.findByText("Belgian Grand Prix")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Circuit de Spa-Francorchamps")
    ).toBeInTheDocument();
  });

  test("shows error when dashboard data fails", async () => {
    vi.mocked(fetchSeasonSummary).mockRejectedValue(
      new Error("API failed")
    );

    renderDashboard();

    expect(
      await screen.findByText(
        "Failed to load Formula 1 dashboard data from the API."
      )
    ).toBeInTheDocument();
  });
});