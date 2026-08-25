import { useState } from "react";
import { TableSkeleton, CardGridSkeleton } from "../components/Skeleton";
import { Tags, Plus, Pencil, Trash2 } from "lucide-react";
import api, { errMsg } from "../services/api";
import { submitOrQueue } from "../services/offlineQueue";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import SearchInput from "../components/SearchInput";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import useSelection from "../hooks/useSelection";
import BulkDeleteBar from "../components/BulkDeleteBar";

import EmptyState from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

export default function Categories() {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = hasPermission(user?.role, "categories:manage");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, loading, refetch } = useFetch(
    () => api.get("/categories", { params: { search: search || undefined } }).then((r) => r.data.data),
    [search]
  );
  const items = data?.items || [];
  const selection = useSelection(items);

  const handleBulkDelete = async () => {
    try {
      const res = await api.delete("/categories/bulk", { data: { ids: selection.selectedIds } });
      const { deleted, failed } = res.data.data || {};
      toast.success(`Deleted ${deleted || 0} categories${failed?.length ? `, ${failed.length} skipped` : ""}`);
      selection.clear();
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const openCreate = () => {
    setEditItem(null);
    setName("");
    setDescription("");
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditItem(c);
    setName(c.name);
    setDescription(c.description || "");
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const result = editItem
        ? await submitOrQueue({ label: "Update category", url: `/categories/${editItem.id}`, method: "PUT", body: { name, description } })
        : await submitOrQueue({ label: "New category", url: "/categories", method: "POST", body: { name, description } });
      toast.success(result.queued ? "Category change queued — will sync" : editItem ? "Category updated" : "Category created");
      setShowForm(false);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Organize your products"
        actions={canManage && <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add Category</button>}
      />

      <SearchInput className="sm:max-w-xs mb-4" value={search} onChange={setSearch} placeholder="Search categories..." />

      <BulkDeleteBar count={selection.count} label="categories" onDelete={handleBulkDelete} onClear={selection.clear} />

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No categories"
            subtitle="Group related products for easier management and reporting."
            action={canManage && <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add Category</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="th w-10">
                    <input type="checkbox" checked={selection.allSelected} onChange={(e) => selection.toggleAll(e.target.checked)} aria-label="Select all" />
                  </th>
                  <th className="th">Name</th>
                  <th className="th">Description</th>
                  <th className="th text-center">Products</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((c) => (
                  <tr key={c.id} className={selection.has(c.id) ? "hover:bg-slate-50/60 bg-brand-50/40" : "hover:bg-slate-50/60"}>
                    <td className="td">
                    <input type="checkbox" checked={selection.has(c.id)} onChange={() => selection.toggle(c.id)} aria-label={`Select ${c.name}`} />
                  </td>
                  <td className="td font-medium">{c.name}</td>
                    <td className="td text-slate-500 max-w-md truncate">{c.description || "—"}</td>
                    <td className="td text-center">
                      <span className="badge bg-brand-50 text-brand-700">{c.productCount}</span>
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        {canManage && (
                          <>
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </>
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? "Edit category" : "Add category"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={2} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title={`Delete "${deleteTarget?.name}"?`}
        message="Products in this category will become uncategorized."
        confirmLabel="Delete"
        onConfirm={async () => {
          try {
            const result = await submitOrQueue({ label: "Delete category", url: `/categories/${deleteTarget.id}`, method: "DELETE" });
            toast.success(result.queued ? "Delete queued — will sync" : "Category deleted");
            refetch();
          } catch (err) {
            toast.error(errMsg(err));
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
