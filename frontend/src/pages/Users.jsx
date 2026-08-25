import { useState } from "react";
import { UserCog, Plus, Pencil } from "lucide-react";
import api, { errMsg } from "../services/api";
import useFetch from "../hooks/useFetch";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import { fmtDateTime, ROLE_LABELS } from "../utils/format";

const ROLES = ["ADMIN", "MANAGER", "EMPLOYEE", "ACCOUNTANT"];

export default function Users() {
  const toast = useToast();
  const { user: me, refresh } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "EMPLOYEE" });
  const [disableTarget, setDisableTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data, loading, refetch } = useFetch(() => api.get("/users").then((r) => r.data.data), []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: "", email: "", phone: "", password: "", role: "EMPLOYEE" });
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditItem(u);
    setForm({ name: u.name, email: u.email, phone: u.phone || "", password: "", role: u.role });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/users/${editItem.id}`, { name: form.name, phone: form.phone, role: form.role });
        toast.success("Team member updated");
      } else {
        await api.post("/users", form);
        toast.success("Team member added — share the credentials securely");
      }
      setShowForm(false);
      refetch();
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    try {
      await api.put(`/users/${disableTarget.id}`, { isActive: !disableTarget.isActive });
      toast.success(disableTarget.isActive ? "Account disabled" : "Account enabled");
      setDisableTarget(null);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
      setDisableTarget(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Employees and their access levels"
        actions={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add member</button>}
      />

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner className="block mx-auto my-14" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="th">Member</th>
                  <th className="th">Role</th>
                  <th className="th">Status</th>
                  <th className="th">Last login</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data || []).map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-medium">{u.name}{u.id === me?.id && <span className="text-xs text-slate-400 ml-1.5">(you)</span>}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <span className={`badge ${
                        u.role === "OWNER" ? "bg-amber-100 text-amber-700"
                          : u.role === "ADMIN" ? "bg-purple-100 text-purple-700"
                          : u.role === "ACCOUNTANT" ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td className="td">
                      <span className={`badge ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        {u.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="td text-slate-500">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</td>
                    <td className="td">
                      {u.role !== "OWNER" && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
                          {u.id !== me?.id && (
                            <button
                              onClick={() => setDisableTarget(u)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${u.isActive ? "hover:bg-red-50 text-red-400 hover:text-red-600" : "hover:bg-emerald-50 text-emerald-600"}`}
                            >
                              {u.isActive ? "Disable" : "Enable"}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-5 mt-5">
        <h2 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2"><UserCog className="w-4 h-4" /> What each role can do</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
          <li><b>Owner</b> — everything, including team management and settings</li>
          <li><b>Admin</b> — all business operations and settings</li>
          <li><b>Manager</b> — sales, purchases, inventory, parties, reports</li>
          <li><b>Accountant</b> — payments, expenses, GST & financial reports</li>
          <li><b>Employee</b> — create sales, view products & customers</li>
        </ul>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? `Edit ${editItem.name}` : "Add team member"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input required minLength={2} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          {!editItem && (
            <>
              <div>
                <label className="label">Email * (used to sign in)</label>
                <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Temporary password * (min 8 chars)</label>
                <input required minLength={8} type="text" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </>
          )}
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Role *</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!disableTarget}
        danger={disableTarget?.isActive}
        title={disableTarget?.isActive ? `Disable ${disableTarget?.name}?` : `Re-enable ${disableTarget?.name}?`}
        message={disableTarget?.isActive ? "They will no longer be able to sign in." : undefined}
        confirmLabel={disableTarget?.isActive ? "Disable account" : "Enable"}
        onConfirm={toggleActive}
        onCancel={() => setDisableTarget(null)}
      />
    </div>
  );
}
