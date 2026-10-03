import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import DriverCard from "./DriverCard";
import RaceCard from "./RaceCard";
import StatCard from "./StatCard";

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
  test("DriverCard renders driver information and details link", () => {
    render(
      <MemoryRouter>
        <DriverCard driverId="lec" name="Charles Leclerc" team="Ferrari" constructorId="FER"
          number={16} nationality="Monégasque" dateOfBirth="1997-10-16" />
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
