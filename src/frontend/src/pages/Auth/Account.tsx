import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";

import { useAuth } from "../../auth/AuthContext";
import { db } from "../../auth/firebase";

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
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your account?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteAccount();
      navigate("/login");
    } catch (err: any) {
      console.error(err);

      if (err.code === "auth/requires-recent-login") {
        setError(
          "For security reasons, please sign out, sign back in, and try deleting your account again."
        );
      } else {
        setError("Failed to delete account.");
      }
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

      const userRef = doc(db, "users", user.uid);

      await updateDoc(userRef, {
        submitterStatus: "pending",
      });

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
        <strong>Role:</strong> {role ?? "Loading..."}
      </p>

      <p>
        <strong>Submitter Status:</strong>{" "}
        {submitterStatus ?? "Loading..."}
      </p>

      {role === "USER" && submitterStatus === "none" && (
        <div style={{ marginTop: "30px" }}>
          <h2>Submitter Access</h2>

          <p>
            Request permission to submit Formula 1 event data
            to the platform.
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

      {role === "USER" && submitterStatus === "pending" && (
        <div style={{ marginTop: "30px" }}>
          <h2>Submitter Access</h2>

          <p>
            Your submitter request is pending admin approval.
          </p>
        </div>
      )}

      {role === "USER" && submitterStatus === "rejected" && (
        <div style={{ marginTop: "30px" }}>
          <h2>Submitter Access</h2>

          <p>
            Your submitter request was rejected.
          </p>
        </div>
      )}

      {role === "SUBMITTER" && (
        <div style={{ marginTop: "30px" }}>
          <h2>Submitter Access</h2>

          <p>
            You are an approved submitter.
          </p>
        </div>
      )}

      {role === "ADMIN" && (
        <div style={{ marginTop: "30px" }}>
          <h2>Administrator</h2>

          <p>
            You have administrator access.
          </p>
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
          style={{
            background: "#c62828",
            color: "white",
          }}
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}

export default Account;