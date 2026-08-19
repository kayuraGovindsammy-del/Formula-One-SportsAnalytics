import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "./AuthContext";

interface SubmitterRouteProps {
  children: ReactNode;
}

function SubmitterRoute({ children }: SubmitterRouteProps) {
  const { user, role, submitterStatus, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const canSubmit =
    role === "ADMIN" ||
    (role === "SUBMITTER" && submitterStatus === "approved");

  if (!canSubmit) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default SubmitterRoute;