import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import MySubmissions from "./MySubmissions";
import { useAuth } from "../../auth/useAuth";
import { submissionRequest } from "../../api/submissions";

vi.mock("../../auth/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../../api/submissions", () => ({ submissionRequest: vi.fn() }));

const user = { uid: "user-1" };
const record = {
  submission_id: 12,
  submitted_by: "user-1",
  submitted_by_email: "user@example.com",
  submitted_at: "2026-09-28T10:00:00.000Z",
  reviewed_at: "2026-09-28T11:00:00.000Z",
  reviewed_by: "admin-1",
  reviewed_by_email: "admin@example.com",
  status: "rejected" as const,
  validation_errors: ["Lap time is invalid"],
  event: {
    event_id: "evt-1",
    session_id: "2025_R1_RACE",
    type: "LAP_COMPLETED",
    timestamp: "2025-03-16T12:00:00.000Z",
    payload: { position: 1 },
  },
};

describe("MySubmissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(submissionRequest).mockResolvedValue([]);
  });

  test("loads and renders an empty state", async () => {
    render(<MySubmissions />);
    expect(screen.getByText("Loading submissions...")).toBeInTheDocument();
    expect(await screen.findByText("No submissions found.")).toBeInTheDocument();
    expect(submissionRequest).toHaveBeenCalledWith(user, "/submissions/mine", expect.any(Object));
  });

  test("renders submission details and review errors", async () => {
    vi.mocked(submissionRequest).mockResolvedValue([record]);
    render(<MySubmissions />);

    expect(await screen.findByRole("heading", { name: "LAP_COMPLETED" })).toBeInTheDocument();
    expect(screen.getByText(/#12/)).toBeInTheDocument();
    expect(screen.getByText("Lap time is invalid")).toBeInTheDocument();
    expect(screen.getAllByText(/2025_R1_RACE/).length).toBeGreaterThan(0);
  });

  test("changes the status filter and reloads", async () => {
    render(<MySubmissions />);
    await screen.findByText("No submissions found.");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pending" } });

    await waitFor(() => {
      expect(submissionRequest).toHaveBeenCalledWith(
        user,
        "/submissions/mine?status=pending",
        expect.any(Object)
      );
    });
  });

  test("shows request errors", async () => {
    vi.mocked(submissionRequest).mockRejectedValue(new Error("API unavailable"));
    render(<MySubmissions />);
    expect(await screen.findByRole("alert")).toHaveTextContent("API unavailable");
  });

  test("refresh button performs another request", async () => {
    render(<MySubmissions />);
    await screen.findByText("No submissions found.");
    const callsBefore = vi.mocked(submissionRequest).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(vi.mocked(submissionRequest).mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
