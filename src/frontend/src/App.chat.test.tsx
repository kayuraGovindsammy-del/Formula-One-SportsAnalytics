import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { useAuth } from "./auth/useAuth";

vi.mock("./auth/useAuth", () => ({ useAuth: vi.fn() }));

// The pages are stubbed: this test is about the widget surviving navigation,
// not about what each page renders or fetches.
const { stub } = vi.hoisted(() => ({
  stub: (name: string) => ({ default: () => <h1>{name} page</h1> }),
}));
vi.mock("./pages/Dashboard/Dashboard", () => stub("Dashboard"));
vi.mock("./pages/Drivers/Drivers", () => stub("Drivers"));
vi.mock("./pages/DriverDetails/DriverDetails", () => stub("Driver details"));
vi.mock("./pages/Races/Races", () => stub("Races"));
vi.mock("./pages/RaceDetails/RaceDetails", () => stub("Race details"));
vi.mock("./pages/Auth/Login", () => stub("Login"));
vi.mock("./pages/Auth/Account", () => stub("Account"));
vi.mock("./pages/Admin/SubmitterRequests", () => stub("Submitter requests"));
vi.mock("./pages/Admin/SubmissionReview", () => stub("Submission review"));
vi.mock("./pages/Submit/SubmitData", () => stub("Submit data"));
vi.mock("./pages/Submit/MySubmissions", () => stub("My submissions"));
vi.mock("./pages/Constructors/Constructors", () => stub("Constructors"));
vi.mock("./pages/Statistics/Statistics", () => stub("Statistics"));

const fetchMock = vi.fn();

function signedIn(signed: boolean, role = "USER", uid = "u1", loading = false) {
  vi.mocked(useAuth).mockReturnValue({
    // A new object every call, as Firebase hands out on a token refresh.
    user: signed ? { uid } : null,
    loading,
    role,
    submitterStatus: "none",
  } as unknown as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App: the chat widget", () => {
  test("keeps the conversation when the user moves to other pages", async () => {
    // As an admin, so the route can change from a ProtectedRoute page to an
    // AdminRoute page: a different component tree, which used to remount the
    // widget (and lose the chat) when it lived inside each page's Layout.
    signedIn(true, "ADMIN");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { reply: "Lando Norris has 394 points.", tools_used: [] }, meta: {} }),
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Dashboard page" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open F1 Assistant" }));
    await user.type(
      screen.getByRole("textbox", { name: "Ask the F1 Assistant a question" }),
      "Norris points?{Enter}"
    );
    expect(await screen.findByText("Lando Norris has 394 points.")).toBeInTheDocument();

    function expectConversationKept() {
      // Same widget, same conversation, still open, and only one of it.
      const log = screen.getByRole("log");
      expect(within(log).getByText("Norris points?")).toBeInTheDocument();
      expect(within(log).getByText("Lando Norris has 394 points.")).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "F1 Assistant" })).toBeInTheDocument();
      expect(document.querySelectorAll(".chat-widget")).toHaveLength(1);
    }

    await user.click(screen.getByRole("link", { name: "Requests" }));
    expect(await screen.findByRole("heading", { name: "Submitter requests page" })).toBeInTheDocument();
    expectConversationKept();

    await user.click(screen.getByRole("link", { name: "Drivers" }));
    expect(await screen.findByRole("heading", { name: "Drivers page" })).toBeInTheDocument();
    expectConversationKept();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("also shows on the login page, which does not use Layout", () => {
    signedIn(false);
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Login page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open F1 Assistant" })).toBeInTheDocument();
  });

});

describe("App: the chat conversation and the signed-in user", () => {
  // A new element each time: re-rendering the same element object would
  // let React skip App, and it would never read the changed auth state.
  const app = () => (
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );

  async function chat(user: ReturnType<typeof userEvent.setup>) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { reply: "Lando Norris has 394 points.", tools_used: [] }, meta: {} }),
    });
    await user.click(screen.getByRole("button", { name: "Open F1 Assistant" }));
    await user.type(
      screen.getByRole("textbox", { name: "Ask the F1 Assistant a question" }),
      "Norris points?{Enter}"
    );
    expect(await screen.findByText("Lando Norris has 394 points.")).toBeInTheDocument();
  }

  async function expectFreshConversation(user: ReturnType<typeof userEvent.setup>) {
    // A fresh widget starts closed; open it and find an empty conversation.
    await user.click(screen.getByRole("button", { name: "Open F1 Assistant" }));
    const log = screen.getByRole("log");
    expect(within(log).queryByText("Norris points?")).toBeNull();
    expect(within(log).queryByText("Lando Norris has 394 points.")).toBeNull();
    expect(within(log).getByText("Try asking:")).toBeInTheDocument();
  }

  test("signing out clears the conversation", async () => {
    signedIn(true);
    const user = userEvent.setup();
    const { rerender } = render(app());
    await chat(user);

    signedIn(false);
    rerender(app());

    // Signed out, the protected page sends the user to /login, where the
    // widget is still shown, with nothing from the previous user.
    expect(await screen.findByRole("heading", { name: "Login page" })).toBeInTheDocument();
    await expectFreshConversation(user);
  });

  test("a different user signing in starts a fresh conversation", async () => {
    signedIn(true, "USER", "u1");
    const user = userEvent.setup();
    const { rerender } = render(app());
    await chat(user);

    signedIn(true, "USER", "u2");
    rerender(app());

    await expectFreshConversation(user);
  });

  test("a token refresh or profile update for the same user keeps the conversation", async () => {
    signedIn(true, "USER", "u1");
    const user = userEvent.setup();
    const { rerender } = render(app());
    await chat(user);

    // Same uid, new user object and a role change: not a different user.
    signedIn(true, "SUBMITTER", "u1");
    rerender(app());

    expect(screen.getByRole("dialog", { name: "F1 Assistant" })).toBeInTheDocument();
    expect(within(screen.getByRole("log")).getByText("Lando Norris has 394 points.")).toBeInTheDocument();
  });

  test("waits for auth to settle before showing the widget", () => {
    signedIn(false, "USER", "u1", true);
    const { rerender } = render(app());

    expect(screen.queryByRole("button", { name: "Open F1 Assistant" })).toBeNull();

    signedIn(true);
    rerender(app());

    expect(screen.getByRole("button", { name: "Open F1 Assistant" })).toBeInTheDocument();
  });
});
