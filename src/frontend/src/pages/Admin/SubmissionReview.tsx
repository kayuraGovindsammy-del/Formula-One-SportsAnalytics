import { useEffect, useState } from "react";

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../auth/firebase";

interface Submission {
  id: string;
  submittedBy: string;
  submittedByEmail: string;
  submittedAt?: any;
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

  validationErrors?: string[];
}

function SubmissionReview() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const submissionsQuery = query(
      collection(db, "submissions"),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      submissionsQuery,
      (snapshot) => {
        const pendingSubmissions: Submission[] = snapshot.docs.map(
          (document) => {
            const data = document.data();

            return {
              id: document.id,
              submittedBy: data.submittedBy ?? "",
              submittedByEmail: data.submittedByEmail ?? "",
              submittedAt: data.submittedAt,
              status: data.status ?? "pending",
              event: data.event ?? {},
              validationErrors: data.validationErrors ?? [],
            };
          }
        );

        setSubmissions(pendingSubmissions);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Failed to load submissions.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const handleAccept = async (submissionId: string) => {
    try {
      setError("");
      setProcessingId(submissionId);

      const submissionRef = doc(
        db,
        "submissions",
        submissionId
      );

      await updateDoc(submissionRef, {
        status: "accepted",
        validationErrors: [],
      });
    } catch (err) {
      console.error(err);
      setError("Failed to accept submission.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (submissionId: string) => {
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

      const submissionRef = doc(
        db,
        "submissions",
        submissionId
      );

      await updateDoc(submissionRef, {
        status: "rejected",
        validationErrors: [reason.trim()],
      });
    } catch (err) {
      console.error(err);
      setError("Failed to reject submission.");
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
              key={submission.id}
              style={{
                border: "1px solid #444",
                borderRadius: "10px",
                padding: "20px",
                marginBottom: "25px",
              }}
            >
              <h2>
                {submission.event?.type ?? "Unknown Event"}
              </h2>

              <p>
                <strong>Submitted By:</strong>{" "}
                {submission.submittedByEmail ||
                  submission.submittedBy}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                {submission.status}
              </p>

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
                    handleAccept(submission.id)
                  }
                  disabled={
                    processingId === submission.id
                  }
                >
                  {processingId === submission.id
                    ? "Processing..."
                    : "Accept"}
                </button>

                <button
                  onClick={() =>
                    handleReject(submission.id)
                  }
                  disabled={
                    processingId === submission.id
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