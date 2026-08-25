import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Store } from "lucide-react";
import { ShopIllustration } from "../components/Illustrations";
import InstallPrompt from "../components/InstallPrompt";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { errMsg } from "../services/api";

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success("Welcome back!");
      navigate(location.state?.from?.pathname || (user.isPlatformAdmin ? "/platform" : user.businessId ? "/dashboard" : "/onboarding"), { replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900">
      <Link to="/login" className="flex items-center gap-2.5 mb-8">
        <span className="rounded-xl bg-brand-500 p-2">
          <Store className="w-6 h-6 text-white" />
        </span>
        <span className="text-white font-bold text-2xl">DukaanSetu</span>
      </Link>

      <InstallPrompt />

      <div className="card w-full max-w-md p-7">
        <ShopIllustration className="w-28 h-auto mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-800 text-center">Sign in</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6 text-center">Manage your business from anywhere.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input"
              placeholder="you@business.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button className="btn-primary w-full !py-2.5" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="flex items-center justify-between mt-5 text-sm">
          <Link to="/forgot-password" className="text-brand-600 hover:underline">
            Forgot password?
          </Link>
          <Link to="/register" className="text-slate-600 hover:text-brand-600 font-medium">
            Create account →
          </Link>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400 text-center max-w-sm">
        Demo credentials — <b>demo@businesshub.in</b> / Demo@1234
      </p>
    </div>
  );
}
