import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "./Spinner";

/** Guards /platform/* routes — only BusinessHub platform admins pass. */
export default function PlatformRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!user.isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}
