import { useState, useEffect } from "react";
import { TableSkeleton, CardGridSkeleton } from "../../components/Skeleton";
import { Trash2, Users2, Plus } from "lucide-react";
import api, { errMsg } from "../../services/api";
import { submitOrQueue } from "../../services/offlineQueue";
import useFetch from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import PageHeader from "../../components/PageHeader";

import EmptyState from "../../components/EmptyState";
import SearchInput from "../../components/SearchInput";
import Pagination from "../../components/Pagination";
import ConfirmDialog from "../../components/ConfirmDialog";
import Modal from "../../components/Modal";
import useSelection from "../../hooks/useSelection";
import BulkDeleteBar from "../../components/BulkDeleteBar";
import { fmtDateTime, ROLE_LABELS } from "../../utils/format";

const ROLES = ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE", "ACCOUNTANT"];

const roleBadge = (u) => {
  if (u.isPlatformAdmin) return "badge bg-slate-900 text-white";
  return u.role === "OWNER" ? "badge bg-amber-100 text-amber-700"
    : u.role === "ADMIN" ? "badge bg-purple-100 text-purple-700"
    : u.role === "ACCOUNTANT" ? "badge bg-blue-100 text-blue-700"
    : "badge bg-slate-100 text-slate-600";
};

export default function PlatformUsers() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ businessId: "", name: "", email: "", password: "", phone: "", role: "EMPLOYEE" });
  const [businesses, setBusinesses] = useState([]);

  const query = `/platform/users?page=${page}&limit=15${search ? `&search=${encodeURIComponent(search)}` : ""}${role ? `&role=${role}` : ""}${status ? `&status=${status}` : ""}`;
  const { data, loading, refetch } = useFetch(() => api.get(query).then((r) => r.data.data), [query]);
  const items = data?.items || [];
  const selection = useSelection(items);

  const handleBulkDelete = async () => {
    try {
      const res = await api.delete("/platform/users/bulk", { data: { ids: selection.selectedIds } });
      const { deleted, failed } = res.data.data || {};
      toast.success(`Deleted ${deleted || 0} users${failed?.length ? `, ${failed.length} skipped` : ""}`);
      selection.clear();
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const loadBusinesses = async () => {
    try {
      const res = await api.get("/platform/businesses?limit=300");
      setBusinesses(res.data.data?.items || []);
    } catch {
      setBusinesses([]);
    }
  };

  const openCreate = () => {
    setForm({ businessId: "", name: "", email: "", password: "", phone: "", role: "EMPLOYEE" });
    setShowForm(true);
    loadBusinesses();
  };

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/platform/users", { ...form, phone: form.phone || undefined });
      toast.success(`User ${form.name} created`);
      setShowForm(false);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (u, newRole) => {
    try {
      const result = await submitOrQueue({ label: "Change user role", url: `/platform/users/${u.id}`, method: "PUT", body: { role: newRole } });
      toast.success(result.queued ? "Change queued — will sync" : `${u.name} is now ${ROLE_LABELS[newRole] || newRole}`);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const toggleActive = async (u) => {
    try {
      const result = await submitOrQueue({ label: "Toggle user", url: `/platform/users/${u.id}`, method: "PUT", body: { isActive: !u.isActive } });
      toast.success(result.queued ? "Change queued — will sync" : u.isActive ? `${u.name} disabled` : `${u.name} re-enabled`);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const doDelete = async () => {
    setSaving(true);
    try {
      const result = await submitOrQueue({ label: "Delete user", url: `/platform/users/${deleteTarget.id}`, method: "DELETE" });
      toast.success(result.queued ? "Delete queued — will sync" : `${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const manageable = (u) => !u.isPlatformAdmin && u.id !== me?.id;

  return (
    <div>
      <PageHeader
        title="All Users"
        subtitle="Every account across all businesses"
        actions={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add user</button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by name, email or phone..."
          className="flex-1"
        />
        <select className="input sm:w-40" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select className="input sm:w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="active">Active only</option>
          <option value="disabled">Disabled only</option>
        </select>
      </div>

      <BulkDeleteBar count={selection.count} label="users" onDelete={handleBulkDelete} onClear={selection.clear} />

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : !data?.items?.length ? (
          <EmptyState icon={Users2} title="No users found" subtitle="Try a different search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th w-10">
                      <input type="checkbox" checked={selection.allSelected} onChange={(e) => selection.toggleAll(e.target.checked)} aria-label="Select all" />
                    </th>
                    <th className="th">User</th>
                    <th className="th">Business</th>
                    <th className="th">Role</th>
                    <th className="th">Status</th>
                    <th className="th">Last login</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((u) => (
                    <tr key={u.id} className={selection.has(u.id) ? "hover:bg-slate-50/60 bg-brand-50/40" : "hover:bg-slate-50/60"}>
                      <td className="td">
                        <input type="checkbox" checked={selection.has(u.id)} onChange={() => selection.toggle(u.id)} aria-label="Select row" />
                      </td>
                      <td className="td">
                      <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-sm shrink-0 ${u.isPlatformAdmin ? "bg-slate-900 text-white" : "bg-brand-100 text-brand-700"}`}>
                          {u.isPlatformAdmin ? "★" : u.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{u.name}{u.id === me?.id && <span className="text-xs text-slate-400 ml-1.5">(you)</span>}</p>
                          <p className="text-xs text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      {u.isPlatformAdmin
                        ? <span className="badge bg-slate-900 text-white !text-[10px]">PLATFORM</span>
                        : <span className="text-sm">{u.business?.name || <span className="text-slate-400">—</span>}</span>}
                    </td>
                    <td className="td">
                      {manageable(u) ? (
                        <select
                          className="input !py-1.5 !px-2 !w-auto text-sm"
                          value={u.role}
                          onChange={(e) => changeRole(u, e.target.value)}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : (
                        <span className={roleBadge(u)}>{u.isPlatformAdmin ? "Platform Admin" : ROLE_LABELS[u.role]}</span>
                      )}
                    </td>
                    <td className="td">
                      <button
                        disabled={!manageable(u)}
                        onClick={() => toggleActive(u)}
                        title={manageable(u) ? "Toggle status" : undefined}
                        className={`badge transition-opacity ${u.isActive ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-red-50 text-red-600 hover:bg-red-100"} disabled:opacity-70 disabled:hover:bg-inherit`}
                      >
                        {u.isActive ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td className="td text-slate-500">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</td>
                    <td className="td">
                      {manageable(u) && (
                        <div className="flex justify-end">
                          <button onClick={() => setDeleteTarget(u)} title="Delete user" className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={data?.meta} onPage={setPage} />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        loading={saving}
        title={`Delete ${deleteTarget?.name}?`}
        message={`${deleteTarget?.email} will permanently lose access. Their business and its data are not affected.`}
        confirmLabel="Delete user"
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create user">
        <form onSubmit={createUser} className="space-y-4">
          <div>
            <label className="label">Business *</label>
            <select
              required
              className="input"
              value={form.businessId}
              onChange={(e) => setForm({ ...form, businessId: e.target.value })}
            >
              <option value="">Select a business…</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}{b.ownerName ? ` (${b.ownerName})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Name *</label>
            <input required minLength={2} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email * (sign-in)</label>
            <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Temporary password * (min 8 chars)</label>
            <input required minLength={8} type="text" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
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
            <button className="btn-primary" disabled={saving}>{saving ? "Creating…" : "Create user"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
