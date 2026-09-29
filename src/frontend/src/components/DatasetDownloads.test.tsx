import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import DatasetDownloads from "./DatasetDownloads";
import { API_BASE_URL } from "../api/submissions";
import Races from "../pages/Races/Races";

vi.mock("../data/f1Data", () => ({
  fetchRaces: vi.fn().mockResolvedValue([]),
}));

describe("DatasetDownloads", () => {
  test("links each format to the export endpoint for the given season", () => {
    render(<DatasetDownloads dataset="drivers" season="2025" label="drivers" />);

    const csv = screen.getByRole("link", {
      name: "Download 2025 drivers as CSV",
    });
    const json = screen.getByRole("link", {
      name: "Download 2025 drivers as JSON",
    });

    expect(csv).toHaveAttribute(
      "href",
      `${API_BASE_URL}/export/drivers?format=csv&season=2025`
    );
    expect(json).toHaveAttribute(
      "href",
      `${API_BASE_URL}/export/drivers?format=json&season=2025`
    );
    expect(csv).toHaveAttribute("download");
    expect(csv).toHaveTextContent("Download CSV");
    expect(json).toHaveTextContent("Download JSON");
  });

  test("the Races page offers downloads for the season it shows", async () => {
    render(
      <MemoryRouter>
        <Races />
      </MemoryRouter>
    );

    // The links render once loading finishes; the heading alone is not a
    // signal, since the loading view shows it too.
    const csv = await screen.findByRole("link", {
      name: "Download 2025 calendar as CSV",
    });
    const json = screen.getByRole("link", {
      name: "Download 2025 calendar as JSON",
    });

    expect(
      screen.getByRole("heading", { name: "2025 Races" })
    ).toBeInTheDocument();
    expect(csv).toHaveAttribute(
      "href",
      `${API_BASE_URL}/export/races?format=csv&season=2025`
    );
    expect(json).toHaveAttribute(
      "href",
      `${API_BASE_URL}/export/races?format=json&season=2025`
    );
    expect(csv).toHaveTextContent("Download 2025 calendar (CSV)");
    expect(json).toHaveTextContent("Download 2025 calendar (JSON)");

    const resultsCsv = screen.getByRole("link", {
      name: "Download 2025 results as CSV",
    });
    const resultsJson = screen.getByRole("link", {
      name: "Download 2025 results as JSON",
    });

    expect(resultsCsv).toHaveAttribute(
      "href",
      `${API_BASE_URL}/export/results?format=csv&season=2025`
    );
    expect(resultsJson).toHaveAttribute(
      "href",
      `${API_BASE_URL}/export/results?format=json&season=2025`
    );
    expect(resultsCsv).toHaveAttribute("download");
    expect(resultsCsv).toHaveTextContent("Download 2025 results (CSV)");
    expect(resultsJson).toHaveTextContent("Download 2025 results (JSON)");
  });
});
