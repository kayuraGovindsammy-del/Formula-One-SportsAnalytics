import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Navbar from "./Navbar";
import Layout from "./Layout";
import { useAuth } from "../../auth/useAuth";

vi.mock("../../auth/useAuth", () => ({ useAuth: vi.fn() }));

function renderNavbar(role: string, submitterStatus: string) {
  vi.mocked(useAuth).mockReturnValue({ role, submitterStatus } as unknown as ReturnType<typeof useAuth>);
  return render(<MemoryRouter><Navbar /></MemoryRouter>);
}

describe("Navbar and Layout", () => {
  beforeEach(() => vi.clearAllMocks());

  test("ordinary users see the common navigation only", () => {
    renderNavbar("USER", "none");
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Drivers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Races" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Constructors" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Statistics" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Submit Data" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Requests" })).not.toBeInTheDocument();
  });

  test("approved submitters see Submit Data", () => {
    renderNavbar("SUBMITTER", "approved");
    expect(screen.getByRole("link", { name: "Submit Data" })).toHaveAttribute("href", "/submit");
  });

  test("admins see submission and review links", () => {
    renderNavbar("ADMIN", "approved");
    expect(screen.getByRole("link", { name: "Submit Data" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Requests" })).toHaveAttribute("href", "/admin/submitter-requests");
    expect(screen.getByRole("link", { name: "Reviews" })).toHaveAttribute("href", "/admin/submissions");
  });

  test("Layout renders Navbar and its children", () => {
    vi.mocked(useAuth).mockReturnValue({ role: "USER", submitterStatus: "none" } as unknown as ReturnType<typeof useAuth>);
    render(<MemoryRouter><Layout><h1>Page body</h1></Layout></MemoryRouter>);
    expect(screen.getByText("F1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Page body" })).toBeInTheDocument();
    // The chat widget is rendered once by App, outside the routes, not per page.
    expect(screen.queryByRole("button", { name: "Open F1 Assistant" })).not.toBeInTheDocument();
  });
});
