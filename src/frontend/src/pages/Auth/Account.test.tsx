import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Account from "./Account";
import { useAuth } from "../../auth/useAuth";
import { requestSubmitterAccess } from "../../auth/submitterAccess";

vi.mock("../../auth/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../../auth/submitterAccess", () => ({ requestSubmitterAccess: vi.fn() }));

const logout = vi.fn();
const deleteAccount = vi.fn();
const baseUser = {
  uid: "user-1",
  displayName: "Test User",
  email: "test@example.com",
  photoURL: "/profile.png",
  providerData: [{ providerId: "password" }],
};

function renderAccount() {
  return render(
    <MemoryRouter initialEntries={["/account"]}>
      <Routes>
        <Route path="/account" element={<Account />} />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(useAuth).mockReturnValue({
      user: baseUser,
      role: "USER",
      submitterStatus: "none",
      logout,
      deleteAccount,
    } as unknown as ReturnType<typeof useAuth>);
  });

  test("renders account details and submitter request action", () => {
    renderAccount();
    expect(screen.getByRole("heading", { name: "My Account" })).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request Submitter Access" })).toBeInTheDocument();
  });

  test("requests submitter access successfully", async () => {
    vi.mocked(requestSubmitterAccess).mockResolvedValue(undefined);
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Request Submitter Access" }));
    expect(await screen.findByText("Your submitter access request has been sent for admin approval.")).toBeInTheDocument();
    expect(requestSubmitterAccess).toHaveBeenCalledWith(baseUser);
  });

  test("shows submitter request failure", async () => {
    vi.mocked(requestSubmitterAccess).mockRejectedValue(new Error("fail"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Request Submitter Access" }));
    expect(await screen.findByText("Failed to submit request. Please try again.")).toBeInTheDocument();
  });

  test("signs out and navigates to login", async () => {
    logout.mockResolvedValue(undefined);
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(await screen.findByRole("heading", { name: "Login destination" })).toBeInTheDocument();
  });

  test("requires password confirmation for password-only account deletion", async () => {
    renderAccount();
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    const deleteButton = screen.getByRole("button", { name: "Delete Account" });
    expect(deleteButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "secret" } });
    expect(deleteButton).toBeEnabled();
  });

  test("deletes account and navigates to login", async () => {
    deleteAccount.mockResolvedValue("complete");
    renderAccount();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith("secret"));
    expect(await screen.findByRole("heading", { name: "Login destination" })).toBeInTheDocument();
  });

  test("renders signed-out state", () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
    renderAccount();
    expect(screen.getByText("You are not signed in.")).toBeInTheDocument();
  });
});
