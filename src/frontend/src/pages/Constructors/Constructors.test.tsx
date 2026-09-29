import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Constructors from "./Constructors";
import {
  fetchConstructorStatistics,
  fetchDrivers,
} from "../../data/f1Data";

vi.mock("../../data/f1Data", () => ({
  fetchDrivers: vi.fn(),
  fetchConstructorStatistics: vi.fn(),
}));

vi.mock("../../data/teamStyles", () => ({
  getTeamStyle: vi.fn(() => ({
    primary: "#000000",
    secondary: "#ffffff",
  })),
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
    driverId: "PIA",
    name: "Oscar Piastri",
    team: "McLaren",
    constructorId: "MCL",
    number: 81,
    nationality: "Australian",
    dateOfBirth: "2001-04-06",
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

describe("Constructors", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(fetchDrivers).mockResolvedValue(mockDrivers);

    vi.mocked(fetchConstructorStatistics).mockImplementation(
      async (constructorId) => {
        if (constructorId === "MCL") {
          return {
            constructorId: "MCL",
            constructorName: "McLaren",
            season: "2025",
            points: 500,
          } as Awaited<
            ReturnType<typeof fetchConstructorStatistics>
          >;
        }

        return {
          constructorId: "FER",
          constructorName: "Ferrari",
          season: "2025",
          points: 400,
        } as Awaited<
          ReturnType<typeof fetchConstructorStatistics>
        >;
      }
    );
  });

  function renderConstructors() {
    return render(<Constructors />);
  }

  test("loads and displays constructors", async () => {
    renderConstructors();

    expect(
      screen.getByText("Loading constructors...")
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", {
        name: "McLaren",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Ferrari",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Showing 2 constructors")
    ).toBeInTheDocument();
  });

  test("displays constructor drivers", async () => {
    renderConstructors();

    await screen.findByRole("heading", {
      name: "McLaren",
    });

    expect(
      screen.getByText("Lando Norris")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Oscar Piastri")
    ).toBeInTheDocument();
  });

  test("orders constructors by points", async () => {
    renderConstructors();

    await screen.findByRole("heading", {
      name: "McLaren",
    });

    expect(
      screen.getByText("Formula 1 Team — P1")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Formula 1 Team — P2")
    ).toBeInTheDocument();
  });

  test("filters constructors by search", async () => {
    const user = userEvent.setup();

    renderConstructors();

    await screen.findByRole("heading", {
      name: "McLaren",
    });

    await user.type(
      screen.getByLabelText("Search constructors"),
      "Ferrari"
    );

    expect(
      screen.getByRole("heading", {
        name: "Ferrari",
      })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "McLaren",
      })
    ).not.toBeInTheDocument();

    expect(
      screen.getByText("Showing 1 constructor")
    ).toBeInTheDocument();
  });

  test("shows an error if driver data fails to load", async () => {
    vi.mocked(fetchDrivers).mockRejectedValue(
      new Error("API failure")
    );

    renderConstructors();

    expect(
      await screen.findByText(
        "Failed to load constructor information."
      )
    ).toBeInTheDocument();
  });
});