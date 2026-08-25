import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../services/api";
import { useToast } from "../context/ToastContext";

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setSent(true);
      setDevToken(res.data.data?.devToken || null);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900">
      <div className="card w-full max-w-md p-7">
        {sent ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-800">Check your email</h1>
            <p className="text-sm text-slate-500 mt-2">
              If an account exists for <b>{email}</b>, a password reset link has been generated.
              In production this is delivered by your email provider (see README — Email integration).
            </p>
            {devToken && (
              <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3 text-left">
                <p className="text-xs font-semibold text-slate-500">Development mode reset token:</p>
                <code className="text-xs break-all text-brand-700">{devToken}</code>
              </div>
            )}
            {devToken && (
              <Link
                to={`/reset-password?token=${devToken}`}
                className="btn-primary mt-4 w-full"
              >
                Continue to reset password
              </Link>
            )}
            <Link to="/login" className="block mt-3 text-sm text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-800">Forgot password?</h1>
            <p className="text-sm text-slate-500 mt-1 mb-6">
              Enter your account email and we'll generate a reset link.
            </p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="btn-primary w-full !py-2.5" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
            <Link to="/login" className="block mt-5 text-sm text-brand-600 hover:underline">
              ← Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
