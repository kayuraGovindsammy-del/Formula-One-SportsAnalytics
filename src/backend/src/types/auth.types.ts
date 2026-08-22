export type UserRole =
  | "USER"
  | "SUBMITTER"
  | "ADMIN";

export type SubmitterStatus =
  | "NONE"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  submitterStatus: SubmitterStatus;
}