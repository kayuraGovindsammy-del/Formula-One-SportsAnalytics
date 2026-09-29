import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Races from "./Races";
import { fetchRaces } from "../../data/f1Data";

vi.mock("../../data/f1Data", () => ({
  fetchRaces: vi.fn(),
}));

vi.mock("../../components/RaceCard", () => ({
  default: ({
    name,
    country,
    circuitName,
  }: {
    name: string;
    country: string;
    circuitName: string;
  }) => (
    <article>
      <h2>{name}</h2>
      <p>{country}</p>
      <p>{circuitName}</p>
    </article>
  ),
}));

const mockRaces = [
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
    grandPrixId: "MON",
    seasonId: "2025",
    round: 8,
    name: "Monaco Grand Prix",
    circuitName: "Circuit de Monaco",
    locality: "Monaco",
    country: "Monaco",
    date: "2025-05-25",
    hasSprint: false,
    hasResults: true,
  },
];

describe("Races", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchRaces).mockResolvedValue(mockRaces);
  });

  function renderRaces() {
    return render(
      <MemoryRouter>
        <Races />
      </MemoryRouter>
    );
  }

  test("loads and displays races", async () => {
    renderRaces();

    expect(
      screen.getByText("Loading races...")
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Australian Grand Prix")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Monaco Grand Prix")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Showing 2 races")
    ).toBeInTheDocument();
  });

  test("filters races by race name", async () => {
    const user = userEvent.setup();

    renderRaces();

    await screen.findByText("Australian Grand Prix");

    await user.type(
      screen.getByLabelText("Search races"),
      "Monaco"
    );

    expect(
      screen.getByText("Monaco Grand Prix")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Australian Grand Prix")
    ).not.toBeInTheDocument();
  });

  test("filters races by country", async () => {
    const user = userEvent.setup();

    renderRaces();

    await screen.findByText("Australian Grand Prix");

    await user.type(
      screen.getByLabelText("Search races"),
      "Australia"
    );

    expect(
      screen.getByText("Australian Grand Prix")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Monaco Grand Prix")
    ).not.toBeInTheDocument();
  });

  test("shows API error", async () => {
    vi.mocked(fetchRaces).mockRejectedValue(
      new Error("API failure")
    );

    renderRaces();

    expect(
      await screen.findByText(
        "Failed to load races from the API."
      )
    ).toBeInTheDocument();
  });
});