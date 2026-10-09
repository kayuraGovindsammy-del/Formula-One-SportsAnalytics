import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { submissionRequest, type SubmissionRecord } from "../../api/submissions";
import "../submissionPages.css";

export default function SubmissionReview() {
  const { user } = useAuth();
  const [records, setRecords] = useState<SubmissionRecord[]>([]);
  const [status, setStatus] = useState("pending");
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const records = await submissionRequest<SubmissionRecord[]>(
        user, `/submissions${status === "all" ? "" : `?status=${status}`}`, { signal }
      );
      if (!signal?.aborted) setRecords(records);
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : "Could not load submissions.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user, status]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    submissionRequest<SubmissionRecord[]>(user, `/submissions${status === "all" ? "" : `?status=${status}`}`, { signal: controller.signal })
      .then((records) => {
        if (!controller.signal.aborted) {
          setRecords(records);
          setError("");
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Could not load submissions.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user, status]);

  const review = async (record: SubmissionRecord, decision: "accepted" | "rejected") => {
    if (!user || processingId !== null) return;
    const reason = (reasons[record.submission_id] ?? "").trim();
    if (decision === "rejected" && !reason) {
      setError("Enter a rejection reason.");
      return;
    }
    if (!window.confirm(`${decision === "accepted" ? "Accept" : "Reject"} submission #${record.submission_id}?`))
      return;
    setProcessingId(record.submission_id);
    setError("");
    setMessage("");
    try {
      await submissionRequest(user, `/submissions/${record.submission_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: decision,
          validation_errors: decision === "rejected" ? [reason] : [],
        }),
      });
      setMessage(`Submission #${record.submission_id} ${decision}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="submission-page submission-review-page">
      <h1>Submission Review</h1>
      <p>Review F1 event data before it is published to Neon. Acceptance is permanent and may require a correction workflow to change later.</p>
      <div className="submission-toolbar">
        <label>Show{" "}
          <select value={status} onChange={event => { setLoading(true); setStatus(event.target.value); }}>
            <option value="pending">Pending</option>
            <option value="all">All</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <button onClick={() => void load()} disabled={loading}>Refresh</button>
      </div>
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
      {loading && <p>Loading submissions...</p>}
      {!loading && !error && records.length === 0 && <p>No submissions found.</p>}
      {!loading && records.map(record => (
        <article key={record.submission_id} style={{
          border: "1px solid #444", borderRadius: 10, padding: 20, marginBottom: 20
        }}>
          <div className="submission-card-heading">
  <h2>{record.event.type}</h2>

  <span
    className={`status-badge status-${record.status}`}
  >
    {record.status}
  </span>
</div>
          <p><strong>Submission ID:</strong> {record.submission_id}</p>
          <p><strong>Event ID:</strong> {record.event.event_id}</p>
          <p><strong>Session:</strong> {record.event.session_id}</p>
          <p><strong>Submitted by:</strong> {record.submitted_by_email ?? record.submitted_by ?? "Unknown"}</p>
          <p><strong>Submitted:</strong> {new Date(record.submitted_at).toLocaleString()}</p>
          {record.reviewed_at && <p><strong>Reviewed:</strong> {new Date(record.reviewed_at).toLocaleString()}
            {record.reviewed_by_email ? ` by ${record.reviewed_by_email}` : ""}</p>}
          {record.validation_errors.map((reason, index) => <p key={index}><strong>Review reason:</strong> {reason}</p>)}
          <details>
            <summary>Inspect event payload</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(record.event, null, 2)}
            </pre>
          </details>
          {record.status === "pending" && (
            <div style={{ marginTop: 20 }}>
              <label style={{ display: "block" }}>Rejection reason
                <textarea rows={3} maxLength={2000}
                  value={reasons[record.submission_id] ?? ""}
                  onChange={event => setReasons(previous => ({
                    ...previous, [record.submission_id]: event.target.value,
                  }))}
                  disabled={processingId !== null}
                  style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: 10 }}
                />
              </label>
              <div className="submission-actions">
                <button onClick={() => void review(record, "accepted")} disabled={processingId !== null}>
                  {processingId === record.submission_id ? "Processing..." : "Accept"}
                </button>
                <button className="danger-button"  onClick={() => void review(record, "rejected")}
                  disabled={processingId !== null || !(reasons[record.submission_id] ?? "").trim()}>
                  Reject
                </button>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
