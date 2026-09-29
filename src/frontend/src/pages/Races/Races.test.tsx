import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Races from "./Races";
import { fetchRaces, type Race } from "../../data/f1Data";

vi.mock("../../data/f1Data", () => ({
  fetchRaces: vi.fn(),
}));

const races: Race[] = [
  {
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
  },
  {
    grandPrixId: "gp-miami",
    seasonId: "2025",
    round: 6,
    name: "Miami Grand Prix",
    circuitName: "Miami International Autodrome",
    locality: "Miami",
    country: "United States",
    date: "2025-05-04",
    hasSprint: true,
    hasResults: true,
  },
  {
    grandPrixId: "gp-belgium",
    seasonId: "2025",
    round: 14,
    name: "Belgian Grand Prix",
    circuitName: "Circuit de Spa-Francorchamps",
    locality: "Spa",
    country: "Belgium",
    date: "2025-07-27",
    hasSprint: true,
    hasResults: true,
  },
];

function renderRaces() {
  return render(
    <MemoryRouter>
      <Races />
    </MemoryRouter>
  );
}

async function findRaceHeadings() {
  return screen.findAllByRole("heading", { level: 2 });
}

describe("Races search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("search matches on race name", async () => {
    vi.mocked(fetchRaces).mockResolvedValue(races);

    const user = userEvent.setup();

    renderRaces();

    await findRaceHeadings();

    await user.type(
      screen.getByLabelText("Search races"),
      "belgian"
    );

    const headings = await findRaceHeadings();

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Belgian Grand Prix",
    ]);
  });

  test("search matches on country", async () => {
    vi.mocked(fetchRaces).mockResolvedValue(races);

    const user = userEvent.setup();

    renderRaces();

    await findRaceHeadings();

    await user.type(
      screen.getByLabelText("Search races"),
      "states"
    );

    const headings = await findRaceHeadings();

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Miami Grand Prix",
    ]);
  });

  test("search matches on circuit name", async () => {
    vi.mocked(fetchRaces).mockResolvedValue(races);

    const user = userEvent.setup();

    renderRaces();

    await findRaceHeadings();

    await user.type(
      screen.getByLabelText("Search races"),
      "autodrome"
    );

    const headings = await findRaceHeadings();

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Miami Grand Prix",
    ]);
  });

  test("shows an error when races fail to load", async () => {
    vi.mocked(fetchRaces).mockRejectedValue(
      new Error("network down")
    );

    renderRaces();

    expect(
      await screen.findByText(
        "Failed to load races from the API."
      )
    ).toBeInTheDocument();
  });
});

const mockRaces: Race[] = [
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
