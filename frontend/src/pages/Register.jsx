import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Store } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api, { errMsg } from "../services/api";

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success("Account created! Set up your business.");
      navigate("/onboarding", { replace: true });
    } catch (err) {
      const fieldErrors = err.response?.data?.errors;
      if (fieldErrors?.length) toast.error(fieldErrors[0].message);
      else toast.error(errMsg(err));
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
        <span className="text-white font-bold text-2xl">BusinessHub</span>
      </Link>

      <div className="card w-full max-w-md p-7">
        <h1 className="text-xl font-bold text-slate-800">Create your account</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          Free to start. Set up your business in the next step.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input
              required
              minLength={2}
              className="input"
              placeholder="Ramesh Kumar"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
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
            <label className="label">Phone</label>
            <input
              required
              className="input"
              placeholder="9876543210"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              minLength={8}
              className="input"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button className="btn-primary w-full !py-2.5" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
