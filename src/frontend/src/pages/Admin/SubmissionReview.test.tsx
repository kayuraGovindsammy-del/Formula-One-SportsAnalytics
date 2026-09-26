import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SubmissionReview from "./SubmissionReview";
import { useAuth } from "../../auth/useAuth";
import { submissionRequest } from "../../api/submissions";

vi.mock("../../auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../api/submissions", () => ({
  submissionRequest: vi.fn(),
}));

const mockUser = {
  uid: "admin-user",
};

const pendingSubmission = {
  submission_id: 101,
  status: "pending",
  submitted_by: "user-1",
  submitted_by_email: "user@example.com",
  submitted_at: "2026-09-26T10:00:00.000Z",
  reviewed_at: null,
  reviewed_by_email: null,
  validation_errors: [],
  event: {
    event_id: "evt_test_123",
    session_id: "2025_R13_RACE",
    type: "LAP_COMPLETED",
    driver_id: "PIA",
    lap_number: 5,
    timestamp: "2025-07-27T14:30:00.000Z",
    payload: {
      lap_time_ms: 92481,
      position: 1,
      is_pit_lap: false,
      is_valid: true,
    },
  },
};

describe("SubmissionReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(submissionRequest).mockResolvedValue([
      pendingSubmission,
    ]);

    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  test("loads and displays pending submissions", async () => {
    render(<SubmissionReview />);

    expect(
      screen.getByText("Loading submissions...")
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", {
        name: "LAP_COMPLETED",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("evt_test_123")
    ).toBeInTheDocument();

    expect(
      screen.getByText("user@example.com")
    ).toBeInTheDocument();

    expect(submissionRequest).toHaveBeenCalledWith(
      mockUser,
      "/submissions?status=pending",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  test("shows a message when no submissions are found", async () => {
    vi.mocked(submissionRequest).mockResolvedValue([]);

    render(<SubmissionReview />);

    expect(
      await screen.findByText("No submissions found.")
    ).toBeInTheDocument();
  });

  test("shows an error when submissions fail to load", async () => {
    vi.mocked(submissionRequest).mockRejectedValue(
      new Error("Could not load submissions.")
    );

    render(<SubmissionReview />);

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Could not load submissions.");
  });

  test("changes the submission status filter", async () => {
    const user = userEvent.setup();

    render(<SubmissionReview />);

    await screen.findByRole("heading", {
      name: "LAP_COMPLETED",
    });

    vi.mocked(submissionRequest).mockClear();

    await user.selectOptions(
      screen.getByRole("combobox"),
      "accepted"
    );

    await waitFor(() => {
      expect(submissionRequest).toHaveBeenCalledWith(
        mockUser,
        "/submissions?status=accepted",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  test("accepts a pending submission", async () => {
    const user = userEvent.setup();

    vi.mocked(submissionRequest)
      .mockResolvedValueOnce([pendingSubmission])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([pendingSubmission]);

    render(<SubmissionReview />);

    await screen.findByRole("heading", {
      name: "LAP_COMPLETED",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Accept",
      })
    );

    await waitFor(() => {
      expect(submissionRequest).toHaveBeenCalledWith(
        mockUser,
        "/submissions/101",
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent(
      "Submission #101 accepted."
    );
  });

  test("requires a rejection reason before rejection", async () => {
    render(<SubmissionReview />);

    await screen.findByRole("heading", {
      name: "LAP_COMPLETED",
    });

    const rejectButton = screen.getByRole("button", {
      name: "Reject",
    });

    expect(rejectButton).toBeDisabled();
  });

  test("rejects a submission with a reason", async () => {
    const user = userEvent.setup();

    vi.mocked(submissionRequest)
      .mockResolvedValueOnce([pendingSubmission])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([pendingSubmission]);

    render(<SubmissionReview />);

    await screen.findByRole("heading", {
      name: "LAP_COMPLETED",
    });

    await user.type(
      screen.getByLabelText("Rejection reason"),
      "Invalid lap data"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Reject",
      })
    );

    await waitFor(() => {
      expect(submissionRequest).toHaveBeenCalledWith(
        mockUser,
        "/submissions/101",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            status: "rejected",
            validation_errors: ["Invalid lap data"],
          }),
        })
      );
    });

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent(
      "Submission #101 rejected."
    );
  });
});