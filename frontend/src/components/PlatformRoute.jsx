import { Navigate, useLocation } from "react-router-dom";
import { PageSkeleton } from "./Skeleton";
import { useAuth } from "../context/AuthContext";

/** Guards /platform/* routes — only DukaanSetu platform admins pass. */
export default function PlatformRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!user.isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}
