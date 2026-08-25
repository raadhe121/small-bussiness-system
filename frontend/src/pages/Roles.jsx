import { useState } from "react";
import { Shield, Plus, Pencil, Trash2, Lock, Users2 } from "lucide-react";
import api, { errMsg } from "../services/api";
import { submitOrQueue } from "../services/offlineQueue";
import useFetch from "../hooks/useFetch";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { CardGridSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import { useToast } from "../context/ToastContext";
import { ALL_PERMISSIONS } from "../utils/permissions";

function PermissionPicker({ selected, onChange }) {
  const allKeys = ALL_PERMISSIONS.flatMap((g) => g.items.map((i) => i.key));
  const allSelected = allKeys.every((k) => selected.includes(k));

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 select-none cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 accent-brand-600"
          checked={allSelected}
          onChange={(e) => onChange(e.target.checked ? allKeys : [])}
        />
        Select all permissions
      </label>
      {ALL_PERMISSIONS.map((group) => (
        <div key={group.group} className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{group.group}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {group.items.map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-sm text-slate-700 select-none cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-brand-600"
                  checked={selected.includes(item.key)}
                  onChange={(e) =>
                    onChange(e.target.checked ? [...selected, item.key] : selected.filter((k) => k !== item.key))
                  }
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Roles() {
  const toast = useToast();
  const { data, loading, refetch } = useFetch(() => api.get("/roles").then((r) => r.data.data), []);
  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", permissions: [] });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditRole(null);
    setForm({ name: "", description: "", permissions: ["dashboard:view"] });
    setShowForm(true);
  };

  const openEdit = (role) => {
    setEditRole(role);
    setForm({ name: role.name, description: role.description || "", permissions: [...role.permissions] });
    setShowForm(true);
  };

  const save = async () => {
    if (form.permissions.length === 0) {
      toast.error("Select at least one permission");
      return;
    }
    setSaving(true);
    try {
      const result = editRole
        ? await submitOrQueue({ label: "Update role", url: `/roles/${editRole.id}`, method: "PUT", body: form })
        : await submitOrQueue({ label: "New role", url: "/roles", method: "POST", body: form });
      toast.success(result.queued ? "Role change queued — will sync" : editRole ? "Role updated — changes apply immediately" : "Role created — assign it from the Team page");
      setShowForm(false);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try {
      const result = await submitOrQueue({ label: "Delete role", url: `/roles/${deleteTarget.id}`, method: "DELETE" });
      toast.success(result.queued ? "Delete queued — will sync" : "Role deleted");
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
        title="Roles & Permissions"
        subtitle="Custom roles control exactly what each team member can see and do"
        actions={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> New Role</button>}
      />

      {loading ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Built-in roles */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
              <Lock className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-800 text-sm">Built-in roles</h2>
              <span className="ml-auto text-xs text-slate-400">Read-only</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {(data?.system || []).map((role) => (
                <li key={role.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{role.name}</p>
                    <span className="badge bg-slate-100 text-slate-500">
                      {role.permissions.includes("*") ? "All permissions" : `${role.permissions.length} permissions`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{role.description}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Custom roles */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
              <Shield className="w-4 h-4 text-brand-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Your custom roles</h2>
            </div>
            {!data?.custom?.length ? (
              <EmptyState
                icon={Shield}
                title="No custom roles yet"
                subtitle="Create a role with exactly the permissions your business needs, then assign it to team members."
                action={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> New Role</button>}
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.custom.map((role) => (
                  <li key={role.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{role.name}</p>
                        {role.userCount > 0 && (
                          <span className="badge bg-brand-50 text-brand-700"><Users2 className="w-3 h-3" /> {role.userCount}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {role.description || `${role.permissions.length} permissions granted`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(role)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Edit role">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(role)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600" title="Delete role">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Create / edit modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editRole ? `Edit role: ${editRole.name}` : "Create custom role"} size="lg">
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Role name *</label>
              <input
                className="input"
                required
                placeholder='e.g. "Store Supervisor"'
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                placeholder="What is this role for?"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <PermissionPicker selected={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : editRole ? "Save changes" : "Create role"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete role "${deleteTarget?.name}"?`}
        message="Members keep their access until you reassign them to another role."
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
