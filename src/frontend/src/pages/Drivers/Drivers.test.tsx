import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Drivers from "./Drivers";
import { fetchDrivers, type Driver } from "../../data/f1Data";

vi.mock("../../data/f1Data", () => ({
  fetchDrivers: vi.fn(),
}));

const drivers: Driver[] = [
  {
    driverId: "VER",
    number: 1,
    name: "Max Verstappen",
    team: "Red Bull Racing",
    constructorId: "RBR",
    nationality: "NED",
    dateOfBirth: "1997-09-30",
  },
  {
    driverId: "HAM",
    number: 44,
    name: "Lewis Hamilton",
    team: "Ferrari",
    constructorId: "FER",
    nationality: "GBR",
    dateOfBirth: "1985-01-07",
  },
  {
    driverId: "LEC",
    number: 16,
    name: "Charles Leclerc",
    team: "Ferrari",
    constructorId: "FER",
    nationality: "MON",
    dateOfBirth: "1997-10-16",
  },
  {
    driverId: "NOR",
    number: 4,
    name: "Lando Norris",
    team: "McLaren",
    constructorId: "MCL",
    nationality: "GBR",
    dateOfBirth: "1999-11-13",
  },
];

function renderDrivers() {
  return render(
    <MemoryRouter>
      <Drivers />
    </MemoryRouter>
  );
}

async function findDriverHeadings() {
  return screen.findAllByRole("heading", { level: 3 });
}

describe("Drivers filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("filters by name search, case-insensitively", async () => {
    vi.mocked(fetchDrivers).mockResolvedValue(drivers);

    const user = userEvent.setup();

    renderDrivers();

    await findDriverHeadings();

    await user.type(
      screen.getByLabelText("Search drivers"),
      "HAM"
    );

    const headings = await findDriverHeadings();

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Lewis Hamilton",
    ]);
  });

  test("team dropdown lists deduped teams in alphabetical order", async () => {
    vi.mocked(fetchDrivers).mockResolvedValue(drivers);

    renderDrivers();

    await findDriverHeadings();

    const select = screen.getByLabelText("Filter drivers by team");
    const options = within(select).getAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "All Teams",
      "Ferrari",
      "McLaren",
      "Red Bull Racing",
    ]);
  });

  test("combines the team filter and search term with AND logic", async () => {
    vi.mocked(fetchDrivers).mockResolvedValue(drivers);

    const user = userEvent.setup();

    renderDrivers();

    await findDriverHeadings();

    await user.selectOptions(
      screen.getByLabelText("Filter drivers by team"),
      "Ferrari"
    );

    let headings = await findDriverHeadings();

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Lewis Hamilton",
      "Charles Leclerc",
    ]);

    await user.type(
      screen.getByLabelText("Search drivers"),
      "charles"
    );

    headings = await findDriverHeadings();

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Charles Leclerc",
    ]);
  });

  test("shows an error when drivers fail to load", async () => {
    vi.mocked(fetchDrivers).mockRejectedValue(
      new Error("network down")
    );

    renderDrivers();

    expect(
      await screen.findByText(
        "Failed to load drivers from the API."
      )
    ).toBeInTheDocument();
  });
});

const mockDrivers: Driver[] = [
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
