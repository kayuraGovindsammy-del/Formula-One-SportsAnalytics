import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Drivers from "./Drivers";
import { fetchDrivers } from "../../data/f1Data";

vi.mock("../../data/f1Data", () => ({
  fetchDrivers: vi.fn(),
}));

vi.mock("../../components/DriverCard", () => ({
  default: ({ name, team }: { name: string; team: string }) => (
    <article>
      <h2>{name}</h2>
      <p>{team}</p>
    </article>
  ),
}));

const mockDrivers = [
  {
    driverId: "NOR",
    name: "Lando Norris",
    team: "McLaren",
    constructorId: "MCL",
    number: 4,
    nationality: "British",
    dateOfBirth: "1999-11-13",
  },
  {
    driverId: "LEC",
    name: "Charles Leclerc",
    team: "Ferrari",
    constructorId: "FER",
    number: 16,
    nationality: "Monégasque",
    dateOfBirth: "1997-10-16",
  },
];

describe("Drivers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchDrivers).mockResolvedValue(mockDrivers);
  });

  function renderDrivers() {
    return render(
      <MemoryRouter>
        <Drivers />
      </MemoryRouter>
    );
  }

  test("loads and displays drivers", async () => {
    renderDrivers();

    expect(
      screen.getByText("Loading drivers...")
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Lando Norris")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Charles Leclerc")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Showing 2 drivers")
    ).toBeInTheDocument();
  });

  test("filters drivers by search term", async () => {
    const user = userEvent.setup();

    renderDrivers();

    await screen.findByText("Lando Norris");

    await user.type(
      screen.getByLabelText("Search drivers"),
      "lando"
    );

    expect(
      screen.getByText("Lando Norris")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Charles Leclerc")
    ).not.toBeInTheDocument();

    expect(
      screen.getByText("Showing 1 driver")
    ).toBeInTheDocument();
  });

  test("filters drivers by team", async () => {
    const user = userEvent.setup();

    renderDrivers();

    await screen.findByText("Lando Norris");

    await user.selectOptions(
      screen.getByLabelText("Filter drivers by team"),
      "Ferrari"
    );

    expect(
      screen.getByText("Charles Leclerc")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Lando Norris")
    ).not.toBeInTheDocument();
  });

  test("shows API error", async () => {
    vi.mocked(fetchDrivers).mockRejectedValue(
      new Error("API failure")
    );

    renderDrivers();

    expect(
      await screen.findByText(
        "Failed to load drivers from the API."
      )
    ).toBeInTheDocument();
  });
});