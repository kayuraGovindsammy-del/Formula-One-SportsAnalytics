import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import { requestSubmitterAccess } from "../../auth/submitterAccess";

function Account() {
  const {
    user,
    role,
    submitterStatus,
    logout,
    deleteAccount,
  } = useAuth();

  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const usesPassword = user?.providerData.some(p => p.providerId === "password") ?? false;
  const usesGoogle = user?.providerData.some(p => p.providerId === "google.com") ?? false;

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error(err);
      setError("Failed to sign out.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirmed || deleteLoading) return;
    if (usesPassword && !usesGoogle && !deletePassword) {
      setError("Enter your current password to confirm deletion.");
      return;
    }
    const confirmed = window.confirm(
      "Permanently delete this account? Your sign-in and profile will be removed. " +
      "Historical F1 submissions will remain with anonymized contributor details. " +
      "This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      setError("");
      setMessage("");
      setDeleteLoading(true);
      const status = await deleteAccount(deletePassword || undefined);
      navigate("/login", {
        replace: true,
        state: {
          accountMessage: status === "pending"
            ? "Your deletion request has been accepted. Account cleanup is in progress."
            : "Your account has been deleted.",
        },
      });
    } catch (err: unknown) {
      const code = typeof err === "object" && err !== null && "code" in err
        ? String(err.code) : "";
      if (code === "auth/requires-recent-login") {
        setError("Please sign in again and retry account deletion.");
      } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("The current password is incorrect.");
      } else {
        setError(err instanceof Error ? err.message : "Account deletion failed.");
      }
    } finally {
      setDeleteLoading(false);
      setDeletePassword("");
    }
  };

  const handleSubmitterRequest = async () => {
    if (!user) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setRequestLoading(true);

      await requestSubmitterAccess(user);

      setMessage(
        "Your submitter access request has been sent for admin approval."
      );
    } catch (err) {
      console.error(err);
      setError("Failed to submit request. Please try again.");
    } finally {
      setRequestLoading(false);
    }
  };

  if (!user) {
    return (
      <div style={{ padding: "40px" }}>
        <h2>You are not signed in.</h2>

        <button onClick={() => navigate("/login")}>
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "700px",
        margin: "60px auto",
        padding: "30px",
      }}
    >
      <h1>My Account</h1>

      {user.photoURL && (
        <img
          src={user.photoURL}
          alt="Profile"
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            marginBottom: "20px",
          }}
        />
      )}

      <p>
        <strong>Name:</strong>{" "}
        {user.displayName || "Not available"}
      </p>

      <p>
        <strong>Email:</strong> {user.email}
      </p>

      <p>
        <strong>Role:</strong>{" "}
        {role ?? "Loading..."}
      </p>

      <p>
        <strong>Submitter Status:</strong>{" "}
        {submitterStatus ?? "Loading..."}
      </p>

      {role === "USER" &&
        submitterStatus === "none" && (
          <div style={{ marginTop: "30px" }}>
            <h2>Submitter Access</h2>

            <p>
              Request permission to submit Formula 1 event
              data to the platform.
            </p>

            <button
              onClick={handleSubmitterRequest}
              disabled={requestLoading}
            >
              {requestLoading
                ? "Sending Request..."
                : "Request Submitter Access"}
            </button>
          </div>
        )}

      {role === "USER" &&
        submitterStatus === "pending" && (
          <div style={{ marginTop: "30px" }}>
            <h2>Submitter Access</h2>

            <p>
              Your submitter request is pending admin
              approval.
            </p>
          </div>
        )}

      {role === "USER" &&
        submitterStatus === "rejected" && (
          <div style={{ marginTop: "30px" }}>
            <h2>Submitter Access</h2>
            <p>Your submitter request was rejected. You may submit a new request.</p>
            <button onClick={handleSubmitterRequest} disabled={requestLoading}>
              {requestLoading ? "Sending Request..." : "Request Submitter Access Again"}
            </button>
          </div>
        )}

      {role === "SUBMITTER" && (
        <div style={{ marginTop: "30px" }}>
          <h2>Submitter Access</h2>

          <p>You are an approved submitter.</p>
        </div>
      )}

      {role === "ADMIN" && (
        <div style={{ marginTop: "30px" }}>
          <h2>Administrator</h2>

          <p>You have administrator access.</p>
        </div>
      )}

      {message && (
        <p
          style={{
            marginTop: "20px",
            color: "green",
          }}
        >
          {message}
        </p>
      )}

      {error && (
        <p
          style={{
            marginTop: "20px",
            color: "red",
          }}
        >
          {error}
        </p>
      )}

      <section style={{ marginTop: "32px", padding: "20px", border: "1px solid #c62828", borderRadius: "8px" }}>
        <h2>Delete account</h2>
        <p>
          This permanently removes your Firebase sign-in and profile. Your Neon
          contact details will be anonymized. Historical submissions and their
          contributor/reviewer references are retained for data traceability.
        </p>
        <p>You will be asked to reauthenticate before deletion.</p>
        {usesPassword && (
          <label style={{ display: "block", marginBottom: "12px" }}>
            {usesGoogle ? "Current password (or leave blank to confirm with Google)" : "Current password"}
            <input type="password" autoComplete="current-password"
              value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
              disabled={deleteLoading}
              style={{ display: "block", width: "100%", padding: "10px", boxSizing: "border-box", marginTop: "6px" }} />
          </label>
        )}
        <label style={{ display: "flex", alignItems: "start", gap: "8px" }}>
          <input type="checkbox" checked={deleteConfirmed}
            onChange={e => setDeleteConfirmed(e.target.checked)}
            disabled={deleteLoading} />
          I understand that account deletion is permanent.
        </label>
      </section>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginTop: "40px",
        }}
      >
        <button onClick={handleLogout}>
          Sign Out
        </button>

        <button
          onClick={handleDeleteAccount}
          disabled={deleteLoading || !deleteConfirmed || (usesPassword && !usesGoogle && !deletePassword)}
          style={{
            background: "#c62828",
            color: "white",
          }}
        >
          {deleteLoading ? "Deleting..." : "Delete Account"}
        </button>
      </div>
    </div>
  );
}

export default Account;