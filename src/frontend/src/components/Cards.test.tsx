import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import DriverCard from "./DriverCard";
import RaceCard from "./RaceCard";
import StatCard from "./StatCard";
import userEvent from "@testing-library/user-event";

vi.mock("../data/teamStyles", () => ({
  getTeamStyle: vi.fn(() => ({ primary: "#ff0000" })),
}));
vi.mock("../data/driverImages", () => ({
  getDriverImage: vi.fn(() => "/driver.png"),
}));
vi.mock("../data/circuitImages", () => ({
  getCircuitImage: vi.fn((country: string) => country === "Italy" ? "/monza.png" : ""),
}));

describe("reusable cards", () => {
  test("RaceCard changes details link when switching tabs", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter>
      <RaceCard
        grandPrixId="BEL"
        round={13}
        name="Belgian Grand Prix"
        circuitName="Circuit de Spa-Francorchamps"
        locality="Stavelot"
        country="Belgium"
        date="2025-07-27"
        hasSprint={false}
        hasResults={true}
      />
    </MemoryRouter>
  );

  // Race is active by default
  expect(
    screen.getByRole("link", {
      name: /view race/i,
    })
  ).toHaveAttribute(
    "href",
    "/races/BEL"
  );

  // Switch to Qualifying
  await user.click(
    screen.getByRole("button", {
      name: /qualifying/i,
    })
  );

  expect(
    screen.getByRole("link", {
      name: /view qualifying/i,
    })
  ).toHaveAttribute(
    "href",
    "/races/BEL/qualifying"
  );

  // Switch to Predictions
  await user.click(
    screen.getByRole("button", {
      name: /predictions/i,
    })
  );

  expect(
    screen.getByRole("link", {
      name: /view predictions/i,
    })
  ).toHaveAttribute(
    "href",
    "/races/BEL/predictions"
  );
});
  test("DriverCard renders driver information and details link", () => {
    render(
      <MemoryRouter>
        <DriverCard driverId="lec" name="Charles Leclerc" team="Ferrari" constructorId="FER"
          number={16} nationality="Monégasque" dateOfBirth="1997-10-16" points={210}
  rank={3} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/drivers/lec");
    expect(screen.getByRole("img", { name: "Charles Leclerc" })).toHaveAttribute("src", "/driver.png");
    expect(screen.getByText("Ferrari")).toBeInTheDocument();
    expect(screen.getByText("Monégasque")).toBeInTheDocument();
  });

  test("RaceCard renders sprint/result state and circuit image", () => {
    render(
      <MemoryRouter>
        <RaceCard grandPrixId="ITA" round={16} name="Italian Grand Prix" circuitName="Monza"
          locality="Monza" country="Italy" date="2025-09-07" hasSprint={true} hasResults={true} />
      </MemoryRouter>
    );
    expect(
  screen.getByRole("link", {
    name: /view race/i,
  })
).toHaveAttribute("href", "/races/ITA");
    expect(screen.getByText("Sprint Weekend")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Italian Grand Prix circuit layout" })).toBeInTheDocument();
  });

  test("RaceCard covers the standard/no-results branch", () => {
    render(
      <MemoryRouter>
        <RaceCard grandPrixId="TEST" round={1} name="Test Grand Prix" circuitName="Test Circuit"
          locality="Test" country="Unknown" date="2025-01-01" hasSprint={false} hasResults={false} />
      </MemoryRouter>
    );
    expect(screen.getByText("Standard Weekend")).toBeInTheDocument();
    expect(screen.getByText("Not available")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("StatCard renders title and value", () => {
    render(<StatCard title="Races" value={24} />);
    expect(screen.getByRole("heading", { name: "Races" })).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
  });
});
