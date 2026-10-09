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

import PredictionsDetails from "./PredictionsDetails";

import {
  fetchDriverStatistics,
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
    fetchDriverStatistics: vi.fn(),

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

const mockedFetchDriverStatistics =
  vi.mocked(fetchDriverStatistics);


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
      constructorName:
        "Red Bull Racing",
      q1TimeMs: 101700,
      q2TimeMs: 101100,
      q3TimeMs: 100900,
    },
  ],
};


const statistics = {
  driverId: "NOR",
  season: "2025",
  racesEntered: 10,
  wins: 3,
  podiums: 7,
  dnfCount: 1,
  dnfRate: 0.1,
  fastestLaps: 2,
  averageFinishPosition: 2.5,
  averageRacePaceMs: 108000,
  points: 180,
  positionsGainedLostAvg: 0.5,
};


function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={[
        "/races/BEL/predictions",
      ]}
    >
      <Routes>
        <Route
          path="/races/:id/predictions"
          element={
            <PredictionsDetails />
          }
        />
      </Routes>
    </MemoryRouter>
  );
}


describe("PredictionsDetails", () => {
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

    mockedFetchDriverStatistics.mockImplementation(
      async driverId => ({
        ...statistics,
        driverId,

        averageFinishPosition:
          driverId === "NOR"
            ? 2
            : driverId === "PIA"
              ? 3
              : 4,
      })
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
        /analysing qualifying and previous race performance/i
      )
    ).toBeInTheDocument();
  });


  it("loads and displays predictions", async () => {
    renderPage();

    expect(
      await screen.findByRole(
        "heading",
        {
          name:
            /belgian grand prix predictions/i,
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
  });


  it("uses driver statistics for every qualifying driver", async () => {
    renderPage();

    await screen.findByText(
      "Lando Norris"
    );

    expect(
      mockedFetchDriverStatistics
    ).toHaveBeenCalledTimes(3);

    expect(
      mockedFetchDriverStatistics
    ).toHaveBeenCalledWith(
      "NOR",
      "2025"
    );

    expect(
      mockedFetchDriverStatistics
    ).toHaveBeenCalledWith(
      "PIA",
      "2025"
    );

    expect(
      mockedFetchDriverStatistics
    ).toHaveBeenCalledWith(
      "VER",
      "2025"
    );
  });


  it("shows the prediction formula", async () => {
    renderPage();

    await screen.findByText(
      "Lando Norris"
    );

    expect(
      screen.getAllByText("60%")
        .length
    ).toBeGreaterThan(0);

    expect(
      screen.getAllByText("40%")
        .length
    ).toBeGreaterThan(0);

    expect(
      screen.getByText(
        "Qualifying Performance"
      )
    ).toBeInTheDocument();

    expect(
      screen.getAllByText(
        "Previous Results"
      ).length
    ).toBeGreaterThan(0);
  });


  it("ranks drivers by the prediction score", async () => {
    renderPage();

    await screen.findByText(
      "Lando Norris"
    );

    const norris =
      screen
        .getByText("Lando Norris")
        .closest(".prediction-row");

    expect(
      norris
    ).not.toBeNull();

    expect(
      norris
    ).toHaveTextContent("P1");
  });


  it("falls back to qualifying position when average finish is missing", async () => {
    mockedFetchDriverStatistics.mockImplementation(
      async driverId => ({
        ...statistics,
        driverId,

        averageFinishPosition:
          driverId === "NOR"
            ? null
            : 5,
      })
    );

    renderPage();

    await screen.findByText(
      "Lando Norris"
    );

    expect(
      screen.getByText(
        "Lando Norris"
      )
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("—")
        .length
    ).toBeGreaterThan(0);
  });


  it("continues when one driver statistics request fails", async () => {
    mockedFetchDriverStatistics.mockImplementation(
      async driverId => {
        if (driverId === "PIA") {
          throw new Error(
            "Statistics unavailable"
          );
        }

        return {
          ...statistics,
          driverId,
        };
      }
    );

    renderPage();

    expect(
      await screen.findByText(
        "Lando Norris"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Oscar Piastri"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Max Verstappen"
      )
    ).toBeInTheDocument();
  });


  it("shows an error when the main race request fails", async () => {
    mockedFetchRace.mockRejectedValue(
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


  it("contains race and qualifying navigation links", async () => {
    renderPage();

    await screen.findByText(
      "Lando Norris"
    );

    expect(
      screen.getByRole("link", {
        name: /^race$/i,
      })
    ).toHaveAttribute(
      "href",
      "/races/BEL"
    );

    expect(
      screen.getByRole("link", {
        name: /^qualifying$/i,
      })
    ).toHaveAttribute(
      "href",
      "/races/BEL/qualifying"
    );
  });
});