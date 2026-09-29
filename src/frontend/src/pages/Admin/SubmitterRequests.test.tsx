import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import SubmitterRequests from "./SubmitterRequests";
import { useAuth } from "../../auth/useAuth";
import { reviewSubmitterRequest } from "../../auth/submitterAccess";
import { onSnapshot } from "firebase/firestore";

vi.mock("../../auth/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../../auth/submitterAccess", () => ({ reviewSubmitterRequest: vi.fn() }));
vi.mock("../../auth/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ collection: true })),
  query: vi.fn((value) => value),
  where: vi.fn(() => ({ where: true })),
  onSnapshot: vi.fn(),
}));

const admin = { uid: "admin-1" };
const requestDoc = {
  id: "user-1",
  data: () => ({
    role: "USER",
    deletionPending: false,
    name: "Applicant",
    email: "applicant@example.com",
    photoURL: "/person.png",
    submitterStatus: "pending",
  }),
};

describe("SubmitterRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: admin, role: "ADMIN" } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(onSnapshot).mockImplementation((...args: unknown[]) => {
      const success = args[1] as (snapshot: { docs: typeof requestDoc[] }) => void;
      success({ docs: [requestDoc] });
      return vi.fn();
    });
  });

  test("loads pending submitter requests", async () => {
    render(<SubmitterRequests />);
    expect(await screen.findByText("Applicant")).toBeInTheDocument();
    expect(screen.getByText("applicant@example.com")).toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute("src", "/person.png");
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  });

  test("approves a request", async () => {
    vi.mocked(reviewSubmitterRequest).mockResolvedValue(undefined);
    render(<SubmitterRequests />);
    await screen.findByText("Applicant");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(reviewSubmitterRequest).toHaveBeenCalledWith(admin, "user-1", "approved", ""));
    expect(screen.getByRole("status")).toHaveTextContent("Submitter approved.");
  });

  test("rejects a request with the entered reason", async () => {
    vi.mocked(reviewSubmitterRequest).mockResolvedValue(undefined);
    render(<SubmitterRequests />);
    await screen.findByText("Applicant");
    fireEvent.change(screen.getByLabelText("Rejection reason"), { target: { value: "Insufficient details" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(reviewSubmitterRequest).toHaveBeenCalledWith(admin, "user-1", "rejected", "Insufficient details"));
    expect(screen.getByRole("status")).toHaveTextContent("Request rejected.");
  });

  test("shows snapshot load errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(onSnapshot).mockImplementation((...args: unknown[]) => {
      const error = args[2] as (err: Error) => void;
      error(new Error("Firestore unavailable"));
      return vi.fn();
    });
    render(<SubmitterRequests />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load submitter requests.");
  });
});
