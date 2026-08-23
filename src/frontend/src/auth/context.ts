import { createContext } from "react";

import type { User } from "firebase/auth";

type UserRole = "USER" | "SUBMITTER" | "ADMIN";

type SubmitterStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected";

export interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  submitterStatus: SubmitterStatus | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const AuthContext = createContext<
  AuthContextType | undefined
>(undefined);
