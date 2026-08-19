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

interface SubmitterRequest {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  submitterStatus: string;
}

function SubmitterRequests() {
  const [requests, setRequests] = useState<SubmitterRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const requestsQuery = query(
      collection(db, "users"),
      where("submitterStatus", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const pendingRequests: SubmitterRequest[] =
          snapshot.docs.map((document) => {
            const data = document.data();

            return {
              uid: document.id,
              name: data.name ?? "Unknown User",
              email: data.email ?? "No email",
              photoURL: data.photoURL ?? "",
              submitterStatus: data.submitterStatus ?? "pending",
            };
          });

        setRequests(pendingRequests);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Failed to load submitter requests.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const handleApprove = async (uid: string) => {
    try {
      setError("");
      setProcessingId(uid);

      const userRef = doc(db, "users", uid);

      await updateDoc(userRef, {
        role: "SUBMITTER",
        submitterStatus: "approved",
      });
    } catch (err) {
      console.error(err);
      setError("Failed to approve submitter.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (uid: string) => {
    try {
      setError("");
      setProcessingId(uid);

      const userRef = doc(db, "users", uid);

      await updateDoc(userRef, {
        role: "USER",
        submitterStatus: "rejected",
      });
    } catch (err) {
      console.error(err);
      setError("Failed to reject submitter.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px" }}>
        <h1>Submitter Requests</h1>
        <p>Loading requests...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "40px auto",
        padding: "30px",
      }}
    >
      <h1>Submitter Requests</h1>

      <p>
        Review users who have requested permission to submit
        Formula 1 event data.
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

      {requests.length === 0 ? (
        <div style={{ marginTop: "30px" }}>
          <p>No pending submitter requests.</p>
        </div>
      ) : (
        <div style={{ marginTop: "30px" }}>
          {requests.map((request) => (
            <div
              key={request.uid}
              style={{
                border: "1px solid #444",
                borderRadius: "10px",
                padding: "20px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                }}
              >
                {request.photoURL && (
                  <img
                    src={request.photoURL}
                    alt={request.name}
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                    }}
                  />
                )}

                <div>
                  <h3>{request.name}</h3>
                  <p>{request.email}</p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {request.submitterStatus}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "20px",
                }}
              >
                <button
                  onClick={() => handleApprove(request.uid)}
                  disabled={processingId === request.uid}
                >
                  {processingId === request.uid
                    ? "Processing..."
                    : "Approve"}
                </button>

                <button
                  onClick={() => handleReject(request.uid)}
                  disabled={processingId === request.uid}
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