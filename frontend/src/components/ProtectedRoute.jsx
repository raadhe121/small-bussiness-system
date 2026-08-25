import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "./Spinner";

/**
 * Route guard.
 *  - requiresAuth: user must be logged in
 *  - requiresBusiness: user must have completed onboarding
 *  - guestOnly: login/register pages redirect authenticated users away
 */
export default function ProtectedRoute({ children, requiresBusiness = true, guestOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;

  if (guestOnly) {
    if (user) {
      return <Navigate to={user.businessId ? "/dashboard" : "/onboarding"} replace />;
    }
    return children;
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requiresBusiness && !user.businessId) return <Navigate to="/onboarding" replace />;
  if (!requiresBusiness && user.businessId) return <Navigate to="/dashboard" replace />;

  return children;
}
