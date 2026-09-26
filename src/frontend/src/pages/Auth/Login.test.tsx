import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./Login";
import { useAuth } from "../../auth/useAuth";

vi.mock("../../auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

const loginWithEmail = vi.fn();
const loginWithGoogle = vi.fn();
const registerWithEmail = vi.fn();
const resetPassword = vi.fn();

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={<h1>Dashboard</h1>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      loginWithEmail,
      loginWithGoogle,
      registerWithEmail,
      resetPassword,
    } as unknown as ReturnType<typeof useAuth>);
  });

  test("renders the login form", () => {
    renderLogin();

    expect(
      screen.getByRole("heading", {
        name: "Sign In",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Email")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Password")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Sign in",
      })
    ).toBeInTheDocument();
  });

  test("logs in with email and password", async () => {
    const user = userEvent.setup();

    loginWithEmail.mockResolvedValue(undefined);

    renderLogin();

    await user.type(
      screen.getByLabelText("Email"),
      "test@example.com"
    );

    await user.type(
      screen.getByLabelText("Password"),
      "password123"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Sign in",
      })
    );

    expect(loginWithEmail).toHaveBeenCalledWith(
      "test@example.com",
      "password123"
    );

    expect(
      await screen.findByRole("heading", {
        name: "Dashboard",
      })
    ).toBeInTheDocument();
  });

  test("shows an error for incorrect credentials", async () => {
    const user = userEvent.setup();

    loginWithEmail.mockRejectedValue({
      code: "auth/invalid-credential",
    });

    renderLogin();

    await user.type(
      screen.getByLabelText("Email"),
      "test@example.com"
    );

    await user.type(
      screen.getByLabelText("Password"),
      "wrongpassword"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Sign in",
      })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "Incorrect email or password."
    );
  });

  test("switches to registration mode", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(
      screen.getByRole("button", {
        name: /don't have an account/i,
      })
    );

    expect(
      screen.getByRole("heading", {
        name: "Create Account",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Confirm Password")
    ).toBeInTheDocument();
  });

  test("rejects registration when passwords do not match", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(
      screen.getByRole("button", {
        name: /don't have an account/i,
      })
    );

    await user.type(
      screen.getByLabelText("Email"),
      "test@example.com"
    );

    await user.type(
      screen.getByLabelText("Password"),
      "password123"
    );

    await user.type(
      screen.getByLabelText("Confirm Password"),
      "different123"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Create account",
      })
    );

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent(
      "Passwords do not match."
    );

    expect(registerWithEmail).not.toHaveBeenCalled();
  });

  test("sends a password reset request", async () => {
    const user = userEvent.setup();

    resetPassword.mockResolvedValue(undefined);

    renderLogin();

    await user.click(
      screen.getByRole("button", {
        name: "Forgot password?",
      })
    );

    expect(
      screen.getByRole("heading", {
        name: "Reset Password",
      })
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Email"),
      "test@example.com"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Send reset email",
      })
    );

    expect(resetPassword).toHaveBeenCalledWith(
      "test@example.com"
    );

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent(
      "password-reset instructions have been sent"
    );
  });

  test("signs in using Google", async () => {
    const user = userEvent.setup();

    loginWithGoogle.mockResolvedValue(undefined);

    renderLogin();

    await user.click(
      screen.getByRole("button", {
        name: "Sign in with Google",
      })
    );

    expect(loginWithGoogle).toHaveBeenCalledTimes(1);

    expect(
      await screen.findByRole("heading", {
        name: "Dashboard",
      })
    ).toBeInTheDocument();
  });
});