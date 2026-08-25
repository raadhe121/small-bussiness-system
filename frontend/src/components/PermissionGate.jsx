import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

/** Blocks a page when the user's role lacks the permission (resource:action). */
export default function PermissionGate({ permission, children }) {
  const { user } = useAuth();
  if (!hasPermission(user?.role, permission)) {
    return (
      <div className="card p-10 text-center">
        <h2 className="font-semibold text-slate-700">Access denied</h2>
        <p className="text-sm text-slate-500 mt-1">
          Your role does not have permission to view this page.
        </p>
      </div>
    );
  }
  return children;
}

export { hasPermission };
