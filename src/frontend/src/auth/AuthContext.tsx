import { useEffect, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  type User,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { AuthContext, type UserRole, type SubmitterStatus } from "./context";

const googleProvider = new GoogleAuthProvider();

async function createUserDocument(user: User): Promise<void> {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) return;

  try {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
      role: "USER",
      submitterStatus: "none",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // A second tab may have created the profile. Never overwrite an
    // existing profile or restore privileged roles from client state.
    if (!(await getDoc(userRef)).exists()) throw error;
  }
}

function normalizeRole(value: unknown): UserRole {
  return value === "ADMIN" || value === "SUBMITTER" ? value : "USER";
}

function normalizeStatus(value: unknown): SubmitterStatus {
  return value === "pending" || value === "approved" || value === "rejected"
    ? value : "none";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [submitterStatus, setSubmitterStatus] = useState<SubmitterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let generation = 0;
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async currentUser => {
      const currentGeneration = ++generation;
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      setUser(null);
      setRole(null);
      setSubmitterStatus(null);
      setAuthError(null);
      setLoading(true);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", currentUser.uid);
      const fail = (error: unknown) => {
        if (generation !== currentGeneration) return;
        console.error("Unable to load account profile:", error);
        setUser(null);
        setRole(null);
        setSubmitterStatus(null);
        setAuthError("Your account profile could not be loaded. Please try again or contact an administrator.");
        setLoading(false);
      };

      try {
        await createUserDocument(currentUser);
        if (generation !== currentGeneration) return;

        unsubscribeProfile = onSnapshot(userRef, snapshot => {
          if (generation !== currentGeneration) return;
          if (!snapshot.exists()) {
            fail(new Error("Account profile is missing."));
            return;
          }
          const data = snapshot.data();
          if (data.deletionPending === true) {
            fail(new Error("Account deletion is pending."));
            return;
          }
          setUser(currentUser);
          setRole(normalizeRole(data.role));
          setSubmitterStatus(normalizeStatus(data.submitterStatus));
          setAuthError(null);
          setLoading(false);
        }, fail);
      } catch (error) {
        fail(error);
      }
    });

    return () => {
      generation++;
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, []);

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await createUserDocument(result.user);
  };

  const registerWithEmail = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await createUserDocument(result.user);
  };

  const loginWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    await createUserDocument(result.user);
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error) {
      // Do not reveal whether an email address has an account.
      if (typeof error === "object" && error !== null &&
          "code" in error && error.code === "auth/user-not-found") return;
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const deleteAccount = async (password?: string): Promise<"complete" | "pending"> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Sign in before deleting your account.");

    const providers = currentUser.providerData.map(item => item.providerId);
    if (providers.includes("password") && password) {
      if (!currentUser.email) throw new Error("Your account has no email address.");
      await reauthenticateWithCredential(
        currentUser,
        EmailAuthProvider.credential(currentUser.email, password)
      );
    } else if (providers.includes("google.com")) {
      await reauthenticateWithPopup(currentUser, googleProvider);
    } else if (providers.includes("password")) {
      throw new Error("Enter your current password to confirm deletion.");
    } else {
      throw new Error("This sign-in method cannot be reauthenticated here.");
    }

    const token = await currentUser.getIdToken(true);
    const base = (import.meta.env.VITE_API_BASE_URL ??
      "https://f1-sport-analytics-api-production.up.railway.app/api/v1").replace(/\/$/, "");

    const response = await fetch(`${base}/users/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        typeof body?.error === "string" ? body.error :
        body?.error?.message ?? "Account deletion could not be started."
      );
    }

    const status = response.status === 202 ? "pending" : "complete";
    // The backend has durably accepted deletion. A local sign-out failure
    // must not be reported as failure to delete the account.
    try {
      await signOut(auth);
    } catch {
      // Server-side deletion and token revocation remain authoritative.
    }
    return status;
  };

  return (
    <AuthContext.Provider value={{
      user, role, submitterStatus, loading, authError,
      loginWithGoogle, registerWithEmail, loginWithEmail, resetPassword,
      logout, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
