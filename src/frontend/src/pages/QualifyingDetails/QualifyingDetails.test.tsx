import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import QualifyingDetails from "./QualifyingDeatils";

import {
  fetchRace,
  fetchRaceQualifying,
} from "../../data/f1Data";


vi.mock("../../data/f1Data", async () => {
  const actual =
    await vi.importActual<
      typeof import("../../data/f1Data")
    >("../../data/f1Data");

  return {
    ...actual,
    fetchRace: vi.fn(),
    fetchRaceQualifying: vi.fn(),

    millisecondsToLapTime: vi.fn(
      (milliseconds: number | null) => {
        if (
          milliseconds === null ||
          milliseconds === undefined
        ) {
          return "—";
        }

        const minutes =
          Math.floor(
            milliseconds / 60000
          );

        const seconds =
          (
            (milliseconds % 60000) /
            1000
          ).toFixed(3);

        return `${minutes}:${seconds.padStart(
          6,
          "0"
        )}`;
      }
    ),
  };
});


const mockedFetchRace =
  vi.mocked(fetchRace);

const mockedFetchRaceQualifying =
  vi.mocked(fetchRaceQualifying);


const race = {
  grandPrixId: "BEL",
  seasonId: "2025",
  round: 13,
  name: "Belgian Grand Prix",
  circuitName:
    "Circuit de Spa-Francorchamps",
  locality: "Stavelot",
  country: "Belgium",
  date: "2025-07-27",
  hasSprint: false,
  hasResults: true,
  sessions: [],
};


const qualifying = {
  grandPrixId: "BEL",
  classification: [
    {
      position: 1,
      driverId: "NOR",
      driverName: "Lando Norris",
      constructorId: "MCL",
      constructorName: "McLaren",
      q1TimeMs: 101200,
      q2TimeMs: 100800,
      q3TimeMs: 100500,
    },
    {
      position: 2,
      driverId: "PIA",
      driverName: "Oscar Piastri",
      constructorId: "MCL",
      constructorName: "McLaren",
      q1TimeMs: 101500,
      q2TimeMs: 101000,
      q3TimeMs: 100700,
    },
    {
      position: 3,
      driverId: "VER",
      driverName: "Max Verstappen",
      constructorId: "RBR",
      constructorName: "Red Bull Racing",
      q1TimeMs: 101700,
      q2TimeMs: 101100,
      q3TimeMs: null,
    },
  ],
};


function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={[
        "/races/BEL/qualifying",
      ]}
    >
      <Routes>
        <Route
          path="/races/:id/qualifying"
          element={
            <QualifyingDetails />
          }
        />
      </Routes>
    </MemoryRouter>
  );
}


describe("QualifyingDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedFetchRace.mockResolvedValue(
      race as Awaited<
        ReturnType<typeof fetchRace>
      >
    );

    mockedFetchRaceQualifying.mockResolvedValue(
      qualifying as Awaited<
        ReturnType<
          typeof fetchRaceQualifying
        >
      >
    );
  });


  it("shows the loading state", () => {
    mockedFetchRace.mockReturnValue(
      new Promise(() => {})
    );

    mockedFetchRaceQualifying.mockReturnValue(
      new Promise(() => {})
    );

    renderPage();

    expect(
      screen.getByText(
        /loading qualifying/i
      )
    ).toBeInTheDocument();
  });


  it("loads and displays qualifying results", async () => {
    renderPage();

    expect(
      await screen.findByRole(
        "heading",
        {
          name:
            /belgian grand prix qualifying/i,
        }
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Lando Norris")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Oscar Piastri")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Max Verstappen"
      )
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("McLaren")
        .length
    ).toBeGreaterThan(0);

    expect(
      mockedFetchRace
    ).toHaveBeenCalledWith("BEL");

    expect(
      mockedFetchRaceQualifying
    ).toHaveBeenCalledWith("BEL");
  });


  it("displays Q1, Q2 and Q3 times", async () => {
    renderPage();

    await screen.findByText(
      "Lando Norris"
    );

    expect(
      screen.getByText("1:41.200")
    ).toBeInTheDocument();

    expect(
      screen.getByText("1:40.800")
    ).toBeInTheDocument();

    expect(
      screen.getByText("1:40.500")
    ).toBeInTheDocument();
  });


  it("handles a missing qualifying time", async () => {
    renderPage();

    await screen.findByText(
      "Max Verstappen"
    );

    expect(
      screen.getAllByText("—").length
    ).toBeGreaterThan(0);
  });


  it("shows an error when qualifying cannot be loaded", async () => {
    mockedFetchRaceQualifying.mockRejectedValue(
      new Error("API failure")
    );

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(
          /failed|could not|unable/i
        )
      ).toBeInTheDocument();
    });
  });


  it("contains navigation back to the race", async () => {
    renderPage();

    await screen.findByText(
      "Lando Norris"
    );

    const raceLink =
      screen.getByRole("link", {
        name: /race/i,
      });

    expect(raceLink).toHaveAttribute(
      "href",
      "/races/BEL"
    );
  });
});