import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { submissionRequest, type SubmissionRecord } from "../../api/submissions";
import "../SubmissionPages.css";

export default function MySubmissions() {
  const { user } = useAuth();
  const [records, setRecords] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const query = filter === "all" ? "" : `?status=${filter}`;
      const records = await submissionRequest<SubmissionRecord[]>(user, `/submissions/mine${query}`, { signal });
      if (!signal?.aborted) setRecords(records);
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : "Could not load submissions.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    submissionRequest<SubmissionRecord[]>(user, `/submissions/mine${filter === "all" ? "" : `?status=${filter}`}`, { signal: controller.signal })
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
  }, [user, filter]);

  return (
   <div className="submission-page my-submissions-page">
      <h1>My Submissions</h1>
      <p>Track your event submissions and any administrator review decisions.</p>
     <div className="submission-toolbar">
        <label>Show{" "}
          <select value={filter} onChange={event => { setLoading(true); setFilter(event.target.value); }}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <button onClick={() => void load()} disabled={loading}>Refresh</button>
      </div>
      {loading && <p>Loading submissions...</p>}
      {error && (
  <p
    role="alert"
    className="submission-alert submission-alert-error"
  >
    {error}
  </p>
)}
      {!loading &&
  !error &&
  records.length === 0 && (
    <div className="submission-empty">
      No submissions found.
    </div>
  )}
      {!loading && records.map(record => (
        <article key={record.submission_id} style={{
          border: "1px solid #444", borderRadius: 10, padding: 20, marginBottom: 16
        }}>
          <div className="submission-card-heading">
  <h2>{record.event.type}</h2>

  <span
    className={`status-badge status-${record.status}`}
  >
    {record.status}
  </span>
</div>
          <p><strong>Submission:</strong> #{record.submission_id}</p>
          <p><strong>Event ID:</strong> {record.event.event_id}</p>
          <p><strong>Session:</strong> {record.event.session_id}</p>
          <p><strong>Submitted:</strong> {new Date(record.submitted_at).toLocaleString()}</p>
          {record.reviewed_at && <p><strong>Reviewed:</strong> {new Date(record.reviewed_at).toLocaleString()}</p>}
          {record.validation_errors.length > 0 && (
            <div role="status">
              <strong>Review reason</strong>
              {record.validation_errors.map((message, index) => <p key={index}>{message}</p>)}
            </div>
          )}
          <details>
            <summary>View submitted event</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(record.event, null, 2)}
            </pre>
          </details>
        </article>
      ))}
    </div>
  );
}
