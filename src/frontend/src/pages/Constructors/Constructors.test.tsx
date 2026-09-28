import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Constructors from "./Constructors";
import {
  fetchConstructorStatistics,
  fetchDrivers,
  type Driver,
} from "../../data/f1Data";

vi.mock("../../data/f1Data", () => ({
  fetchDrivers: vi.fn(),
  fetchConstructorStatistics: vi.fn(),
}));

const threeConstructorDrivers: Driver[] = [
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
    driverId: "LEC",
    number: 16,
    name: "Charles Leclerc",
    team: "Ferrari",
    constructorId: "FER",
    nationality: "MON",
    dateOfBirth: "1997-10-16",
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
    driverId: "NOR",
    number: 4,
    name: "Lando Norris",
    team: "McLaren",
    constructorId: "MCL",
    nationality: "GBR",
    dateOfBirth: "1999-11-13",
  },
];

const pointsByConstructor: Record<string, number> = {
  RBR: 30,
  FER: 20,
  MCL: 10,
};

async function findConstructorHeadings() {
  return screen.findAllByRole("heading", { level: 2 });
}

describe("Constructors standings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sorts constructors by points descending", async () => {
    vi.mocked(fetchDrivers).mockResolvedValue(
      threeConstructorDrivers
    );

    vi.mocked(fetchConstructorStatistics).mockImplementation(
      (constructorId) =>
        Promise.resolve({
          constructorId,
          season: "2025",
          points: pointsByConstructor[constructorId] ?? null,
        })
    );

    render(<Constructors />);

    const headings = await findConstructorHeadings();

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Red Bull Racing",
      "Ferrari",
      "McLaren",
    ]);

    expect(
      screen.getByText("Formula 1 Team — P1")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Formula 1 Team — P2")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Formula 1 Team — P3")
    ).toBeInTheDocument();
  });

  test("sorts null-points constructors last regardless of value", async () => {
    const nullPointsDrivers: Driver[] = [
      {
        driverId: "ALO",
        number: 14,
        name: "Fernando Alonso",
        team: "Alpine",
        constructorId: "ALP",
        nationality: "ESP",
        dateOfBirth: "1981-07-29",
      },
      {
        driverId: "BOT",
        number: 77,
        name: "Valtteri Bottas",
        team: "Sauber",
        constructorId: "SAU",
        nationality: "FIN",
        dateOfBirth: "1989-08-28",
      },
    ];

    vi.mocked(fetchDrivers).mockResolvedValue(nullPointsDrivers);

    vi.mocked(fetchConstructorStatistics).mockImplementation(
      (constructorId) => {
        if (constructorId === "ALP") {
          return Promise.resolve({
            constructorId,
            season: "2025",
            points: 0,
          });
        }

        return Promise.reject(new Error("No stats available."));
      }
    );

    render(<Constructors />);

    const headings = await findConstructorHeadings();

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Alpine",
      "Sauber",
    ]);

    expect(
      screen.getByText("Formula 1 Team — P1")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Formula 1 Team")
    ).toBeInTheDocument();

    expect(screen.getByText("0 pts (2025)")).toBeInTheDocument();
    expect(
      screen.getByText("No points data yet")
    ).toBeInTheDocument();
  });

  test("keeps rank stable when the search filter narrows the list", async () => {
    vi.mocked(fetchDrivers).mockResolvedValue(
      threeConstructorDrivers
    );

    vi.mocked(fetchConstructorStatistics).mockImplementation(
      (constructorId) =>
        Promise.resolve({
          constructorId,
          season: "2025",
          points: pointsByConstructor[constructorId] ?? null,
        })
    );

    const user = userEvent.setup();

    render(<Constructors />);

    await findConstructorHeadings();

    await user.type(
      screen.getByLabelText("Search constructors"),
      "mclaren"
    );

    const headings = await screen.findAllByRole("heading", {
      level: 2,
    });

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "McLaren",
    ]);

    expect(
      screen.getByText("Formula 1 Team — P3")
    ).toBeInTheDocument();
  });
});
