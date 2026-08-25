import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { errMsg, errFieldErrors } from "../services/api";

const BUSINESS_TYPES = [
  ["KIRANA", "Kirana / Grocery store"],
  ["CLOTHING", "Clothing & apparel"],
  ["HARDWARE", "Hardware & tools"],
  ["ELECTRONICS", "Electronics & mobiles"],
  ["GENERAL_RETAIL", "General retail"],
  ["WHOLESALE", "Wholesale"],
  ["DISTRIBUTION", "Distribution"],
  ["OTHER", "Other"],
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
];

export default function Onboarding() {
  const { createBusiness, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    ownerName: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    gstin: "",
    businessType: "GENERAL_RETAIL",
    currency: "INR",
    invoicePrefix: "INV",
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createBusiness(form);
      toast.success("Your business is ready!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const fe = errFieldErrors(err);
      toast.error(Object.values(fe)[0] || errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <span className="rounded-xl bg-brand-500 p-2">
            <Store className="w-6 h-6 text-white" />
          </span>
          <span className="font-bold text-2xl text-slate-800">BusinessHub</span>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${step >= s ? "w-16 bg-brand-600" : "w-10 bg-slate-300"}`} />
          ))}
        </div>

        <form onSubmit={submit} className="card p-6 sm:p-8">
          {step === 1 ? (
            <>
              <h1 className="text-lg font-bold text-slate-800">Tell us about your business</h1>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                This creates your private workspace. Only you and your team can see this data.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Business name *</label>
                  <input required minLength={2} className="input" placeholder="Sharma Kirana Store" value={form.name} onChange={set("name")} />
                </div>
                <div>
                  <label className="label">Owner name *</label>
                  <input required className="input" value={form.ownerName} onChange={set("ownerName")} />
                </div>
                <div>
                  <label className="label">Phone *</label>
                  <input required className="input" placeholder="9876543210" value={form.phone} onChange={set("phone")} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={set("email")} />
                </div>
                <div>
                  <label className="label">Business type</label>
                  <select className="input" value={form.businessType} onChange={set("businessType")}>
                    {BUSINESS_TYPES.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary w-full mt-6"
                onClick={() => {
                  if (!form.name || !form.ownerName || !form.phone) {
                    toast.error("Please fill business name, owner name and phone");
                    return;
                  }
                  setStep(2);
                }}
              >
                Continue →
              </button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold text-slate-800">Location & invoicing</h1>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                Used on invoices and to determine CGST/SGST vs IGST.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Address</label>
                  <input className="input" placeholder="Shop 14, Main Market Road" value={form.address} onChange={set("address")} />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" value={form.city} onChange={set("city")} />
                </div>
                <div>
                  <label className="label">State</label>
                  <select className="input" value={form.state} onChange={set("state")}>
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input className="input" placeholder="302017" maxLength={6} value={form.pincode} onChange={set("pincode")} />
                </div>
                <div>
                  <label className="label">GSTIN (optional)</label>
                  <input className="input uppercase" placeholder="08ABCDE1234F1Z5" maxLength={15} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className="label">Invoice prefix</label>
                  <input className="input uppercase" placeholder="INV" maxLength={12} value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" className="btn-secondary flex-1" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button className="btn-primary flex-1" disabled={loading}>
                  {loading ? "Creating..." : "Create my business"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
