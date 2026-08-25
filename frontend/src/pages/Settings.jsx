import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ShieldCheck, Save, LogOut } from "lucide-react";
import api, { errMsg } from "../services/api";
import { submitOrQueue } from "../services/offlineQueue";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import useFetch from "../hooks/useFetch";

const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
];

export default function Settings() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, logout, refresh } = useAuth();

  const { data: business, refetch: reloadBiz } = useFetch(() => api.get("/business").then((r) => r.data.data), []);

  const [bizForm, setBizForm] = useState(null);
  const [savingBiz, setSavingBiz] = useState(false);

  const [profile, setProfile] = useState({ name: user?.name || "", phone: user?.phone || "" });
  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "" });

  const biz = bizForm ?? business;
  const canManage = ["OWNER", "ADMIN"].includes(user?.role);
  const setB = (k) => (e) => setBizForm({ ...biz, [k]: e.target.value });
  const setBToggle = (k) => (e) => setBizForm({ ...biz, [k]: e.target.checked });

  const saveBusiness = async (e) => {
    e.preventDefault();
    setSavingBiz(true);
    try {
      const result = await submitOrQueue({
        label: "Business settings",
        url: "/business/settings",
        method: "PUT",
        body: {
          name: biz.name,
          ownerName: biz.ownerName,
          phone: biz.phone,
          email: biz.email || "",
          address: biz.address || "",
          city: biz.city || "",
          state: biz.state || "",
          pincode: biz.pincode || "",
          gstin: biz.gstin || "",
          invoicePrefix: biz.invoicePrefix,
          invoiceTerms: biz.invoiceTerms || "",
          upiId: biz.upiId || "",
          bankDetails: biz.bankDetails || "",
          defaultGstRate: Number(biz.defaultGstRate),
          lowStockAlertsEnabled: !!biz.lowStockAlertsEnabled,
          paymentDueAlertsEnabled: !!biz.paymentDueAlertsEnabled,
        },
      });
      toast.success(result.queued ? "Settings change queued — will sync" : "Settings saved");
      setBizForm(null);
      reloadBiz();
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingBiz(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const result = await submitOrQueue({ label: "Profile", url: "/auth/profile", method: "PUT", body: profile });
      toast.success(result.queued ? "Profile change queued — will sync" : "Profile updated");
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const changePwd = async (e) => {
    e.preventDefault();
    try {
      await api.put("/auth/change-password", pwd);
      toast.success("Password changed");
      setPwd({ currentPassword: "", newPassword: "" });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  if (!business) return <Spinner className="block mx-auto my-16" />;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Business, invoicing and security preferences" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Business */}
        <form onSubmit={saveBusiness} className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-600" /> Business details
          </h2>
          <fieldset disabled={!canManage} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Business name</label><input className="input" value={biz?.name || ""} onChange={setB("name")} /></div>
              <div><label className="label">Owner name</label><input className="input" value={biz?.ownerName || ""} onChange={setB("ownerName")} /></div>
              <div><label className="label">Phone</label><input className="input" value={biz?.phone || ""} onChange={setB("phone")} /></div>
              <div><label className="label">Email</label><input type="email" className="input" value={biz?.email || ""} onChange={setB("email")} /></div>
              <div className="sm:col-span-2"><label className="label">Address</label><input className="input" value={biz?.address || ""} onChange={setB("address")} /></div>
              <div><label className="label">City</label><input className="input" value={biz?.city || ""} onChange={setB("city")} /></div>
              <div>
                <label className="label">State (decides CGST+SGST vs IGST)</label>
                <select className="input" value={biz?.state || ""} onChange={setB("state")}>
                  <option value="">—</option>
                  {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Pincode</label><input maxLength={6} className="input" value={biz?.pincode || ""} onChange={setB("pincode")} /></div>
              <div><label className="label">GSTIN</label><input maxLength={15} className="input uppercase" value={biz?.gstin || ""} onChange={(e) => setBizForm({ ...biz, gstin: e.target.value.toUpperCase() })} /></div>
              <div><label className="label">Invoice prefix</label><input className="input uppercase" maxLength={12} value={biz?.invoicePrefix || ""} onChange={(e) => setBizForm({ ...biz, invoicePrefix: e.target.value.toUpperCase() })} /></div>
            </div>

            <h3 className="text-sm font-semibold text-slate-700 pt-2">Invoice settings</h3>
            <div><label className="label">UPI ID (shown on invoices)</label><input className="input" placeholder="yourshop@upi" value={biz?.upiId || ""} onChange={setB("upiId")} /></div>
            <div><label className="label">Bank details (shown on invoices)</label><textarea rows={2} className="input" placeholder={"A/c name\nA/C no. · IFSC"} value={biz?.bankDetails || ""} onChange={setB("bankDetails")} /></div>
            <div><label className="label">Terms & conditions</label><textarea rows={2} className="input" value={biz?.invoiceTerms || ""} onChange={setB("invoiceTerms")} /></div>

            <h3 className="text-sm font-semibold text-slate-700 pt-2">Notifications</h3>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!biz?.lowStockAlertsEnabled} onChange={setBToggle("lowStockAlertsEnabled")} />
              Low stock alerts
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!biz?.paymentDueAlertsEnabled} onChange={setBToggle("paymentDueAlertsEnabled")} />
              Payment due alerts
            </label>
          </fieldset>

          {canManage && (
            <button className="btn-primary mt-4"><Save className="w-4 h-4" /> {savingBiz ? "Saving..." : "Save settings"}</button>
          )}
        </form>

        <div className="space-y-5">
          {/* Profile */}
          <form onSubmit={saveProfile} className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Your profile</h2>
            <div className="space-y-3">
              <div><label className="label">Name</label><input required minLength={2} className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
              <div><label className="label">Phone</label><input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
              <p className="text-xs text-slate-400">Email ({user?.email}) is your sign-in identity and cannot be changed.</p>
            </div>
            <button className="btn-primary mt-4"><Save className="w-4 h-4" /> Save profile</button>
          </form>

          {/* Security */}
          <form onSubmit={changePwd} className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brand-600" /> Change password</h2>
            <div className="space-y-3">
              <div><label className="label">Current password</label><input required type="password" className="input" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} /></div>
              <div><label className="label">New password (min 8 chars)</label><input required minLength={8} type="password" className="input" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} /></div>
            </div>
            <button className="btn-primary mt-4">Update password</button>
          </form>

          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="btn-secondary w-full !text-red-600"
          >
            <LogOut className="w-4 h-4" /> Sign out of BusinessHub
          </button>
        </div>
      </div>
    </div>
  );
}
