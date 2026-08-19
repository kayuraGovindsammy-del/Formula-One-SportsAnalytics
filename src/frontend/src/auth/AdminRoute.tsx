import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "./AuthContext";

interface AdminRouteProps {
  children: ReactNode;
}

function AdminRoute({ children }: AdminRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default AdminRoute;