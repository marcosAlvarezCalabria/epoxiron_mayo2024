import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authService } from "@/services/auth.service";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();

  if (!authService.isAuthenticated()) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return <>{children}</>;
};
