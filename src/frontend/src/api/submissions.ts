import type { User } from "firebase/auth";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ??
  "https://f1-sport-analytics-api-production.up.railway.app/api/v1").replace(/\/$/, "");

export interface SubmissionRecord {
  submission_id: number;
  submitted_by: string | null;
  submitted_by_email: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  status: "pending" | "accepted" | "rejected";
  validation_errors: string[];
  event: {
    event_id: string;
    session_id: string;
    driver_id?: string;
    type: string;
    lap_number?: number;
    timestamp: string;
    payload: Record<string, unknown>;
  };
}

export async function submissionRequest<T>(
  user: User, path: string, options: RequestInit = {}
): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = result as { error?: string | { message?: string } } | null;
    const error = body?.error;
    throw new Error(typeof error === "string" ? error :
      error?.message ?? `Request failed (${response.status}).`);
  }
  return (result as { data: T }).data;
}
