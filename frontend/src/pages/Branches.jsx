import { useState } from "react";
import { Building2, Plus, Pencil, Trash2, Store } from "lucide-react";
import api, { errMsg } from "../services/api";
import { submitOrQueue } from "../services/offlineQueue";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import { TableSkeleton } from "../components/Skeleton";
import useSelection from "../hooks/useSelection";
import BulkDeleteBar from "../components/BulkDeleteBar";
import { useAuth } from "../context/AuthContext";

export default function Branches() {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = ["OWNER", "ADMIN", "MANAGER"].includes(user?.role);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "", isDefault: false });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data, loading, refetch } = useFetch(() => api.get("/branches").then((r) => r.data.data?.items || []), []);
  const branches = data || [];
  const selection = useSelection(branches);

  const handleBulkDelete = async () => {
    try {
      const res = await api.delete("/branches/bulk", { data: { ids: selection.selectedIds } });
      const { deleted, failed } = res.data.data || {};
      toast.success(`Deleted ${deleted || 0} branches${failed?.length ? `, ${failed.length} skipped` : ""}`);
      selection.clear();
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: "", code: "", address: "", phone: "", isDefault: false });
    setShowForm(true);
  };

  const openEdit = (b) => {
    setEditItem(b);
    setForm({ name: b.name, code: b.code || "", address: b.address || "", phone: b.phone || "", isDefault: !!b.isDefault });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || null,
        address: form.address || null,
        phone: form.phone || null,
        isDefault: !!form.isDefault,
      };
      const result = editItem
        ? await submitOrQueue({ label: "Update branch", url: `/branches/${editItem.id}`, method: "PUT", body: payload })
        : await submitOrQueue({ label: "New branch", url: "/branches", method: "POST", body: payload });
      toast.success(result.queued ? "Change queued — will sync" : editItem ? "Branch updated" : "Branch created");
      setShowForm(false);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/branches/${deleteTarget.id}`);
      toast.success("Branch deleted");
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Branches"
        subtitle="Run multiple shops or locations under one business"
        actions={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add branch</button>}
      />

      <BulkDeleteBar count={selection.count} label="branches" onDelete={handleBulkDelete} onClear={selection.clear} />

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : branches.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No branches yet"
            message="Add your first branch to start tracking stock and sales per location."
            action={<button className="btn-primary mt-4" onClick={openCreate}><Plus className="w-4 h-4" /> Add branch</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="th w-10">
                    <input type="checkbox" checked={selection.allSelected} onChange={(e) => selection.toggleAll(e.target.checked)} aria-label="Select all" />
                  </th>
                  <th className="th">Branch</th>
                  <th className="th">Code</th>
                  <th className="th">Address</th>
                  <th className="th">Phone</th>
                  <th className="th">Default</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((b) => (
                  <tr key={b.id} className={selection.has(b.id) ? "hover:bg-slate-50/60 bg-brand-50/40" : "hover:bg-slate-50/60"}>
                    <td className="td">
                      <input type="checkbox" checked={selection.has(b.id)} onChange={() => selection.toggle(b.id)} aria-label="Select row" />
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </span>
                        <span className="font-medium">{b.name}</span>
                      </div>
                    </td>
                    <td className="td text-slate-500">{b.code || "—"}</td>
                    <td className="td text-slate-500 max-w-[220px] truncate">{b.address || "—"}</td>
                    <td className="td text-slate-500">{b.phone || "—"}</td>
                    <td className="td">
                      {b.isDefault && <span className="badge bg-emerald-50 text-emerald-700">Default</span>}
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Edit branch"><Pencil className="w-4 h-4" /></button>
                        {!b.isDefault && (
                          <button onClick={() => setDeleteTarget(b)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600" aria-label="Delete branch"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-5 mt-5 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><Building2 className="w-4 h-4" /> How branches work</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Products share one catalog, but stock is tracked separately at each branch.</li>
          <li>Sales, purchases, expenses and payments are recorded per branch.</li>
          <li>Use the branch switcher in the top bar to filter any screen, or pick “All branches” for consolidated reports.</li>
          <li>Transfer stock between branches from Inventory → Adjust / Transfer.</li>
        </ul>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? `Edit ${editItem.name}` : "Add branch"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Branch name *</label>
            <input required minLength={2} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. MG Road Store" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Code</label>
              <input className="input uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MGR" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="input" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Set as default branch
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title={`Delete ${deleteTarget?.name}?`}
        message="Only branches with no remaining stock and no transactions can be deleted. Reassign users to another branch first if needed."
        confirmLabel="Delete branch"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
