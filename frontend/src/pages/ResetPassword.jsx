import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api, { errMsg } from "../services/api";
import { useToast } from "../context/ToastContext";

export default function ResetPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const token = params.get("token") || "";

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password reset. Please sign in.");
      navigate("/login");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900">
      <div className="card w-full max-w-md p-7">
        <h1 className="text-xl font-bold text-slate-800">Set a new password</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          {token ? "Choose a strong password for your account." : "Missing or invalid reset token."}
        </p>
        {token && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                required
                minLength={8}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="btn-primary w-full !py-2.5" disabled={loading}>
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}
        <Link to="/login" className="block mt-5 text-sm text-brand-600 hover:underline">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
