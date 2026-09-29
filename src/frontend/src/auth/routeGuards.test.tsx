import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";
import SubmitterRoute from "./SubmitterRoute";
import { useAuth } from "./useAuth";

vi.mock("./useAuth", () => ({ useAuth: vi.fn() }));

const baseAuth = {
  user: { uid: "user-1" },
  role: "USER",
  submitterStatus: "none",
  loading: false,
};

function renderRoute(element: React.ReactNode, initialPath = "/private") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<h1>Login page</h1>} />
        <Route path="/" element={<h1>Home page</h1>} />
        <Route path="/private" element={element} />
      </Routes>
    </MemoryRouter>
  );
}

describe("route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("ProtectedRoute shows loading, redirects guests, and renders signed-in users", () => {
    vi.mocked(useAuth).mockReturnValue({ ...baseAuth, loading: true } as unknown as ReturnType<typeof useAuth>);
    const loadingView = renderRoute(<ProtectedRoute><h1>Private content</h1></ProtectedRoute>);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    loadingView.unmount();

    vi.mocked(useAuth).mockReturnValue({ ...baseAuth, user: null } as unknown as ReturnType<typeof useAuth>);
    const guestView = renderRoute(<ProtectedRoute><h1>Private content</h1></ProtectedRoute>);
    expect(screen.getByRole("heading", { name: "Login page" })).toBeInTheDocument();
    guestView.unmount();

    vi.mocked(useAuth).mockReturnValue(baseAuth as unknown as ReturnType<typeof useAuth>);
    renderRoute(<ProtectedRoute><h1>Private content</h1></ProtectedRoute>);
    expect(screen.getByRole("heading", { name: "Private content" })).toBeInTheDocument();
  });

  test("AdminRoute only allows admins", () => {
    vi.mocked(useAuth).mockReturnValue({ ...baseAuth, role: "USER" } as unknown as ReturnType<typeof useAuth>);
    const userView = renderRoute(<AdminRoute><h1>Admin content</h1></AdminRoute>);
    expect(screen.getByRole("heading", { name: "Home page" })).toBeInTheDocument();
    userView.unmount();

    vi.mocked(useAuth).mockReturnValue({ ...baseAuth, role: "ADMIN" } as unknown as ReturnType<typeof useAuth>);
    renderRoute(<AdminRoute><h1>Admin content</h1></AdminRoute>);
    expect(screen.getByRole("heading", { name: "Admin content" })).toBeInTheDocument();
  });

  test("SubmitterRoute allows admins and approved submitters but rejects ordinary users", () => {
    vi.mocked(useAuth).mockReturnValue(baseAuth as unknown as ReturnType<typeof useAuth>);
    const rejectedView = renderRoute(<SubmitterRoute><h1>Submit content</h1></SubmitterRoute>);
    expect(screen.getByRole("heading", { name: "Home page" })).toBeInTheDocument();
    rejectedView.unmount();

    vi.mocked(useAuth).mockReturnValue({
      ...baseAuth,
      role: "SUBMITTER",
      submitterStatus: "approved",
    } as unknown as ReturnType<typeof useAuth>);
    const submitterView = renderRoute(<SubmitterRoute><h1>Submit content</h1></SubmitterRoute>);
    expect(screen.getByRole("heading", { name: "Submit content" })).toBeInTheDocument();
    submitterView.unmount();

    vi.mocked(useAuth).mockReturnValue({ ...baseAuth, role: "ADMIN" } as unknown as ReturnType<typeof useAuth>);
    renderRoute(<SubmitterRoute><h1>Submit content</h1></SubmitterRoute>);
    expect(screen.getByRole("heading", { name: "Submit content" })).toBeInTheDocument();
  });
});
