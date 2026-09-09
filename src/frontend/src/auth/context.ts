import { createContext } from "react";
import type { User } from "firebase/auth";

export type UserRole = "USER" | "SUBMITTER" | "ADMIN";
export type SubmitterStatus = "none" | "pending" | "approved" | "rejected";

export interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  submitterStatus: SubmitterStatus | null;
  loading: boolean;
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password?: string) => Promise<"complete" | "pending">;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
