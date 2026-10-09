import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../auth/firebase";
import { useAuth } from "../../auth/useAuth";
import { reviewSubmitterRequest, type ReviewDecision } from "../../auth/submitterAccess";
import "../SubmissionPages.css";

interface SubmitterRequest {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  submitterStatus: string;
}

function SubmitterRequests() {
  const { user, role } = useAuth();
  const [requests, setRequests] = useState<SubmitterRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || role !== "ADMIN") return;

    const requestsQuery = query(
      collection(db, "users"),
      where("submitterStatus", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      snapshot => {
        setRequests(snapshot.docs
          .filter(document => {
            const data = document.data();
            return data.role === "USER" && data.deletionPending !== true;
          })
          .map(document => {
            const data = document.data();
            return {
              uid: document.id,
              name: data.name ?? "Unknown User",
              email: data.email ?? "No email",
              photoURL: data.photoURL ?? "",
              submitterStatus: data.submitterStatus,
            };
          }));
        setLoading(false);
      },
      err => {
        console.error(err);
        setError("Failed to load submitter requests.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user, role]);

  const handleReview = async (uid: string, decision: ReviewDecision) => {
    if (!user || role !== "ADMIN" || processingId) return;
    try {
      setError("");
      setMessage("");
      setProcessingId(uid);
      await reviewSubmitterRequest(user, uid, decision, reasons[uid] ?? "");
      setMessage(decision === "approved" ? "Submitter approved." : "Request rejected.");
      setReasons(previous => ({ ...previous, [uid]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review request.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="submission-page submitter-requests-page"><h1>Submitter Requests</h1><p>Loading requests...</p></div>;
  }

  return (
    <div className="submission-page submitter-requests-page">
      <h1>Submitter Requests</h1>
      <p>Review users who have requested permission to submit Formula 1 event data.</p>
      {error && (
  <p
    role="alert"
    className="submission-alert submission-alert-error"
  >
    {error}
  </p>
)}

{message && (
  <p
    role="status"
    className="submission-alert submission-alert-success"
  >
    {message}
  </p>
)}
      {requests.length === 0 ? (
        <div className="submission-empty">
  No pending submitter requests.
</div>
      ) : (
        <div style={{ marginTop: "30px" }}>
          {requests.map(request => (
            <div
  key={request.uid}
  className="request-card"
  style={{
    padding: "20px",
    marginBottom: "20px",
  }}
>
              <div className="request-user">
  {request.photoURL && (
    <img
      src={request.photoURL}
      alt=""
      className="request-avatar"
    />
  )}

  <div>
    <h3>{request.name}</h3>
    <p>{request.email}</p>
    <p>
      <strong>Status:</strong> {request.submitterStatus}
    </p>
  </div>
</div>
              <label style={{ display: "block", marginTop: "16px" }}>
                Rejection reason
                <textarea
                  value={reasons[request.uid] ?? ""}
                  onChange={event => setReasons(previous => ({
                    ...previous, [request.uid]: event.target.value,
                  }))}
                  maxLength={1000}
                  rows={2}
                  disabled={processingId !== null}
                  placeholder="Required when rejecting a request"
                  style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: "6px", padding: "10px" }}
                />
              </label>
              <div className="submission-actions">
                <button onClick={() => handleReview(request.uid, "approved")}
                  disabled={processingId !== null}>
                  {processingId === request.uid ? "Processing..." : "Approve"}
                </button>
                <button
  className="danger-button"
  onClick={() =>
    handleReview(
      request.uid,
      "rejected"
    )
  }
  disabled={
    processingId !== null ||
    !(
      reasons[request.uid] ?? ""
    ).trim()
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

export default SubmitterRequests;
