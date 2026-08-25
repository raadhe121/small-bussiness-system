import { useState } from "react";
import { TableSkeleton, CardGridSkeleton } from "../components/Skeleton";
import { Link } from "react-router-dom";
import { Users2, Plus, Pencil, Trash2, Phone } from "lucide-react";
import api, { errMsg } from "../services/api";
import { submitOrQueue } from "../services/offlineQueue";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import SearchInput from "../components/SearchInput";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import useSelection from "../hooks/useSelection";
import BulkDeleteBar from "../components/BulkDeleteBar";

import EmptyState from "../components/EmptyState";
import { inr } from "../utils/format";
import { hasPermission } from "../utils/permissions";

const emptyForm = { name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "", gstin: "", creditLimit: 0 };

/** Shared CRUD page for customers & suppliers (mode = "customer" | "supplier") */
export default function PartiesPage({ mode }) {
  const isCustomer = mode === "customer";
  const base = isCustomer ? "/customers" : "/suppliers";
  const label = isCustomer ? "Customer" : "Supplier";

  const toast = useToast();
  const { user } = useAuth();
  const canManage = hasPermission(user?.role, isCustomer ? "customers:manage" : "suppliers:manage");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, loading, refetch } = useFetch(
    () => api.get(base, { params: { search: search || undefined } }).then((r) => r.data.data),
    [search, mode]
  );
  const items = data?.items || [];
  const selection = useSelection(items);

  const handleBulkDelete = async () => {
    try {
      const endpoint = isCustomer ? "/customers/bulk" : "/suppliers/bulk";
      const res = await api.delete(endpoint, { data: { ids: selection.selectedIds } });
      const { deleted, failed } = res.data.data || {};
      const label = isCustomer ? "customers" : "suppliers";
      toast.success(`Deleted ${deleted || 0} ${label}${failed?.length ? `, ${failed.length} skipped` : ""}`);
      selection.clear();
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name, phone: item.phone, email: item.email || "",
      address: item.address || "", city: item.city || "", state: item.state || "",
      pincode: item.pincode || "", gstin: item.gstin || "",
      creditLimit: isCustomer ? item.creditLimit : undefined,
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const result = editItem
        ? await submitOrQueue({ label: `Update ${label}`, url: `${base}/${editItem.id}`, method: "PUT", body: form })
        : await submitOrQueue({ label: `New ${label}`, url: base, method: "POST", body: form });
      toast.success(result.queued ? `${label} change queued — will sync` : `${label} ${editItem ? "updated" : "created"}`);
      setShowForm(false);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div>
      <PageHeader
        title={isCustomer ? "Customers" : "Suppliers"}
        subtitle={isCustomer ? "Track sales and outstanding payments" : "Track purchases and payables"}
        actions={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add {label}</button>}
      />

      <SearchInput className="sm:max-w-xs mb-4" value={search} onChange={setSearch} placeholder={`Search name or phone...`} />

      {canManage && <BulkDeleteBar count={selection.count} label={isCustomer ? "customers" : "suppliers"} onDelete={handleBulkDelete} onClear={selection.clear} />}

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Users2}
            title={`No ${label.toLowerCase()}s yet`}
            subtitle={search ? "Try a different search." : `Add your first ${label.toLowerCase()}.`}
            action={!search && <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add {label}</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {canManage && (
                    <th className="th w-10">
                      <input type="checkbox" checked={selection.allSelected} onChange={(e) => selection.toggleAll(e.target.checked)} aria-label="Select all" />
                    </th>
                  )}
                  <th className="th">Name</th>
                  <th className="th">Phone</th>
                  <th className="th">City</th>
                  {isCustomer && <th className="th text-right">Credit limit</th>}
                  <th className="th text-right">Outstanding</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((item) => (
                  <tr key={item.id} className={canManage && selection.has(item.id) ? "hover:bg-slate-50/60 bg-brand-50/40" : "hover:bg-slate-50/60"}>
                    {canManage && (
                      <td className="td">
                        <input type="checkbox" checked={selection.has(item.id)} onChange={() => selection.toggle(item.id)} aria-label="Select row" />
                      </td>
                    )}
                    <td className="td">
                      <Link to={`${base}/${item.id}`} className="font-medium hover:text-brand-600">{item.name}</Link>
                      {item.gstin && <p className="text-xs text-slate-400">{item.gstin}</p>}
                    </td>
                    <td className="td"><span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{item.phone}</span></td>
                    <td className="td text-slate-500">{item.city || "—"}</td>
                    {isCustomer && <td className="td text-right">{inr(item.creditLimit)}</td>}
                    <td className="td text-right font-semibold">
                      <span className={Number(item.outstanding) > 0 ? (isCustomer ? "text-emerald-600" : "text-red-600") : "text-slate-400"}>
                        {inr(item.outstanding)}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <Link to={`${base}/${item.id}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Ledger">₹</Link>
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? `Edit ${label}` : `Add ${label}`}>
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Name *</label>
            <input required minLength={2} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone *</label>
            <input required className="input" placeholder="9876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div><label className="label">City</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><label className="label">State</label><input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
          <div><label className="label">Pincode</label><input maxLength={6} className="input" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></div>
          <div><label className="label">GSTIN</label><input className="input uppercase" maxLength={15} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></div>
          {isCustomer && (
            <div>
              <label className="label">Credit limit (₹)</label>
              <input type="number" min="0" className="input" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
            </div>
          )}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title={`Delete "${deleteTarget?.name}"?`}
        message={`${label}s with transaction history cannot be deleted.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          try {
            const result = await submitOrQueue({ label: `Delete ${label}`, url: `${base}/${deleteTarget.id}`, method: "DELETE" });
            toast.success(result.queued ? "Delete queued — will sync" : `${label} deleted`);
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
