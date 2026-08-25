import { Navigate, useLocation } from "react-router-dom";
import { PageSkeleton } from "./Skeleton";
import { useAuth } from "../context/AuthContext";

/**
 * Route guard.
 *  - requiresAuth: user must be logged in
 *  - requiresBusiness: user must have completed onboarding
 *  - guestOnly: login/register pages redirect authenticated users away
 */
export default function ProtectedRoute({ children, requiresBusiness = true, guestOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSkeleton />;

  if (guestOnly) {
    if (user) {
      return <Navigate to={user.isPlatformAdmin ? "/platform" : user.businessId ? "/dashboard" : "/onboarding"} replace />;
    }
    return children;
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requiresBusiness && !user.businessId) return <Navigate to="/onboarding" replace />;
  if (!requiresBusiness && user.businessId) return <Navigate to="/dashboard" replace />;

  return children;
}
