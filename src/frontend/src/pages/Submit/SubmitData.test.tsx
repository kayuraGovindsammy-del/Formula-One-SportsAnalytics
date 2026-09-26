import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import SubmitData from "./SubmitData";
import { useAuth } from "../../auth/useAuth";
import { submissionRequest } from "../../api/submissions";

vi.mock("../../auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../api/submissions", () => ({
  submissionRequest: vi.fn(),
}));

const mockUser = {
  uid: "test-user",
};

function renderSubmitData() {
  return render(
    <MemoryRouter>
      <SubmitData />
    </MemoryRouter>
  );
}

describe("SubmitData", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
    } as unknown as ReturnType<typeof useAuth>);
  });

  test("renders the submission form", () => {
    renderSubmitData();

    expect(
      screen.getByRole("heading", {
        name: "Submit F1 Event Data",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Session ID *")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Event Type *")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Submit Event for Review",
      })
    ).toBeInTheDocument();
  });

  test("shows an error when required fields are missing", async () => {
    const user = userEvent.setup();

    renderSubmitData();

    await user.click(
      screen.getByRole("button", {
        name: "Submit Event for Review",
      })
    );

    expect(
      screen.getByText(/session id is required/i)
    ).toBeInTheDocument();

    expect(submissionRequest).not.toHaveBeenCalled();
  });

  test("does not allow submission when signed out", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
    } as unknown as ReturnType<typeof useAuth>);

    const user = userEvent.setup();

    renderSubmitData();

    await user.click(
      screen.getByRole("button", {
        name: "Submit Event for Review",
      })
    );

    expect(
      screen.getByText(/you must be signed in/i)
    ).toBeInTheDocument();

    expect(submissionRequest).not.toHaveBeenCalled();
  });

  test("submits the same Event ID that is displayed to the user", async () => {
    const user = userEvent.setup();

    vi.mocked(submissionRequest).mockResolvedValue({
      submission_id: 123,
    });

    renderSubmitData();

    const eventIdLabel = screen.getByText(/Event ID:/i);
    const eventIdContainer = eventIdLabel.closest("p");

    expect(eventIdContainer).not.toBeNull();

    const displayedEventId =
      eventIdContainer?.textContent
        ?.replace("Event ID:", "")
        .trim();

    expect(displayedEventId).toBeTruthy();

    await user.type(
      screen.getByLabelText("Session ID *"),
      "2025_R13_RACE"
    );

    await user.type(
      screen.getByLabelText("Driver ID *"),
      "PIA"
    );

    await user.type(
      screen.getByLabelText("Lap Number *"),
      "5"
    );

    await user.type(
      screen.getByLabelText("Event Timestamp *"),
      "2025-07-27T14:30"
    );

    await user.type(
      screen.getByLabelText("Lap Time *"),
      "1:32.481"
    );

    await user.type(
      screen.getByLabelText("Position After Lap *"),
      "1"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Submit Event for Review",
      })
    );

    expect(submissionRequest).toHaveBeenCalledTimes(1);

    const [, , options] =
      vi.mocked(submissionRequest).mock.calls[0];

    const body = JSON.parse(
      String(options?.body)
    );

    expect(body.event.event_id).toBe(displayedEventId);
  });
});