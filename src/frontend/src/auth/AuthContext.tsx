import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  deleteUser,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";

import { auth, db } from "./firebase";
import { AuthContext } from "./context";

type UserRole = "USER" | "SUBMITTER" | "ADMIN";

type SubmitterStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected";

const googleProvider = new GoogleAuthProvider();

async function createUserDocument(user: User) {
  const userRef = doc(db, "users", user.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
      role: "USER",
      submitterStatus: "none",
      createdAt: serverTimestamp(),
    });
  }
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);

  const [role, setRole] =
    useState<UserRole | null>(null);

  const [submitterStatus, setSubmitterStatus] =
    useState<SubmitterStatus | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserDocument:
      | (() => void)
      | undefined;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (unsubscribeUserDocument) {
          unsubscribeUserDocument();
          unsubscribeUserDocument = undefined;
        }

        if (!currentUser) {
          setUser(null);
          setRole(null);
          setSubmitterStatus(null);
          setLoading(false);
          return;
        }

        try {
          setLoading(true);

          await createUserDocument(currentUser);

          setUser(currentUser);

          const userRef = doc(
            db,
            "users",
            currentUser.uid
          );

          unsubscribeUserDocument = onSnapshot(
            userRef,
            (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.data();

                setRole(
                  (data.role ?? "USER") as UserRole
                );

                setSubmitterStatus(
                  (data.submitterStatus ??
                    "none") as SubmitterStatus
                );
              }

              setLoading(false);
            },
            (error) => {
              console.error(
                "Error reading user profile:",
                error
              );

              setLoading(false);
            }
          );
        } catch (error) {
          console.error(
            "Error setting up authenticated user:",
            error
          );

          setLoading(false);
        }
      }
    );

    return () => {
      unsubscribeAuth();

      if (unsubscribeUserDocument) {
        unsubscribeUserDocument();
      }
    };
  }, []);

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(
      auth,
      googleProvider
    );

    await createUserDocument(result.user);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const deleteAccount = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("No authenticated user.");
    }

    const userId = currentUser.uid;

    // Delete the Firestore profile first.
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);

    try {
      // Then delete the Firebase Authentication account.
      await deleteUser(currentUser);
    } catch (error) {
      // If Firebase Auth deletion fails, attempt to restore
      // the Firestore profile so the account is not left
      // in an inconsistent state.
      await setDoc(userRef, {
        uid: currentUser.uid,
        name: currentUser.displayName ?? "",
        email: currentUser.email ?? "",
        photoURL: currentUser.photoURL ?? "",
        role: role ?? "USER",
        submitterStatus:
          submitterStatus ?? "none",
        restoredAt: serverTimestamp(),
      });

      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        submitterStatus,
        loading,
        loginWithGoogle,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

