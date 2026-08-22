import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../auth/AuthContext";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "https://f1-sport-analytics-api-production.up.railway.app/api/v1";

interface Submission {
  submission_id: number;
  submitted_by: string;
  submitted_by_email: string;
  submitted_at?: string;
  status: string;

  event?: {
    event_id?: string;
    session_id?: string;
    driver_id?: string;
    type?: string;
    lap_number?: number;
    timestamp?: string;
    payload?: Record<string, unknown>;
  };

  validation_errors?: string[];
}

function SubmissionReview() {
  const { user } = useAuth();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const [processingId, setProcessingId] =
    useState<number | null>(null);

  const [error, setError] = useState("");

  const loadSubmissions = useCallback(async () => {
    if (!user) {
      setError("You must be signed in.");
      setLoading(false);
      return;
    }

    try {
      setError("");
      setLoading(true);

      const token = await user.getIdToken();

      const response = await fetch(
        `${API_BASE_URL}/submissions`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error?.message ||
            result?.error ||
            "Failed to load submissions."
        );
      }

      const allSubmissions: Submission[] =
        Array.isArray(result.data)
          ? result.data
          : [];

      const pendingSubmissions =
        allSubmissions.filter(
          (submission) =>
            submission.status.toLowerCase() === "pending"
        );

      setSubmissions(pendingSubmissions);
    } catch (err) {
      console.error("Failed to load submissions:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load submissions."
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const handleAccept = async (
    submissionId: number
  ) => {
    if (!user) {
      setError("You must be signed in.");
      return;
    }

    try {
      setError("");
      setProcessingId(submissionId);

      const token = await user.getIdToken();

      const response = await fetch(
        `${API_BASE_URL}/submissions/${submissionId}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            status: "accepted",
            validation_errors: [],
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error?.message ||
            result?.error ||
            "Failed to accept submission."
        );
      }

      await loadSubmissions();
    } catch (err) {
      console.error(
        "Failed to accept submission:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to accept submission."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (
    submissionId: number
  ) => {
    if (!user) {
      setError("You must be signed in.");
      return;
    }

    const reason = window.prompt(
      "Enter the reason for rejecting this submission:"
    );

    if (reason === null) {
      return;
    }

    if (!reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }

    try {
      setError("");
      setProcessingId(submissionId);

      const token = await user.getIdToken();

      const response = await fetch(
        `${API_BASE_URL}/submissions/${submissionId}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            status: "rejected",
            validation_errors: [
              reason.trim(),
            ],
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error?.message ||
            result?.error ||
            "Failed to reject submission."
        );
      }

      await loadSubmissions();
    } catch (err) {
      console.error(
        "Failed to reject submission:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to reject submission."
      );
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px" }}>
        <h1>Submission Review</h1>
        <p>Loading submissions...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "40px auto",
        padding: "30px",
      }}
    >
      <h1>Submission Review</h1>

      <p>
        Review Formula 1 event submissions before they are
        accepted into the platform.
      </p>

      {error && (
        <p
          style={{
            color: "red",
            marginTop: "20px",
          }}
        >
          {error}
        </p>
      )}

      {submissions.length === 0 ? (
        <p style={{ marginTop: "30px" }}>
          No pending submissions.
        </p>
      ) : (
        <div style={{ marginTop: "30px" }}>
          {submissions.map((submission) => (
            <div
              key={submission.submission_id}
              style={{
                border: "1px solid #444",
                borderRadius: "10px",
                padding: "20px",
                marginBottom: "25px",
              }}
            >
              <h2>
                {submission.event?.type ??
                  "Unknown Event"}
              </h2>

              <p>
                <strong>Submission ID:</strong>{" "}
                {submission.submission_id}
              </p>

              <p>
                <strong>Submitted By:</strong>{" "}
                {submission.submitted_by_email ||
                  submission.submitted_by}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                {submission.status}
              </p>

              {submission.submitted_at && (
                <p>
                  <strong>Submitted At:</strong>{" "}
                  {new Date(
                    submission.submitted_at
                  ).toLocaleString()}
                </p>
              )}

              <hr />

              <p>
                <strong>Event ID:</strong>{" "}
                {submission.event?.event_id ?? "-"}
              </p>

              <p>
                <strong>Session ID:</strong>{" "}
                {submission.event?.session_id ?? "-"}
              </p>

              <p>
                <strong>Driver ID:</strong>{" "}
                {submission.event?.driver_id ?? "N/A"}
              </p>

              <p>
                <strong>Lap Number:</strong>{" "}
                {submission.event?.lap_number ?? "N/A"}
              </p>

              <p>
                <strong>Timestamp:</strong>{" "}
                {submission.event?.timestamp ?? "-"}
              </p>

              <h3>Payload</h3>

              <pre
                style={{
                  background: "#111",
                  padding: "15px",
                  borderRadius: "8px",
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(
                  submission.event?.payload ?? {},
                  null,
                  2
                )}
              </pre>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "20px",
                }}
              >
                <button
                  onClick={() =>
                    handleAccept(
                      submission.submission_id
                    )
                  }
                  disabled={
                    processingId ===
                    submission.submission_id
                  }
                >
                  {processingId ===
                  submission.submission_id
                    ? "Processing..."
                    : "Accept"}
                </button>

                <button
                  onClick={() =>
                    handleReject(
                      submission.submission_id
                    )
                  }
                  disabled={
                    processingId ===
                    submission.submission_id
                  }
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SubmissionReview;