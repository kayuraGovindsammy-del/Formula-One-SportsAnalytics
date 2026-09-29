import { describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { AuthContext, type AuthContextType } from "./context";
import { useAuth } from "./useAuth";

const value: AuthContextType = {
  user: null,
  role: "USER",
  submitterStatus: "none",
  loading: false,
  authError: null,
  loginWithGoogle: vi.fn(),
  registerWithEmail: vi.fn(),
  loginWithEmail: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  deleteAccount: vi.fn(),
};

describe("useAuth", () => {
  test("returns the current auth context", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current).toBe(value);
  });

  test("throws when used outside AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used inside an AuthProvider"
    );
  });
});
