import { useState } from "react";
import { Link } from "react-router-dom";
import { Users2, Plus, Pencil, Trash2, Phone } from "lucide-react";
import api, { errMsg } from "../services/api";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import SearchInput from "../components/SearchInput";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { inr } from "../utils/format";

const emptyForm = { name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "", gstin: "", creditLimit: 0 };

/** Shared CRUD page for customers & suppliers (mode = "customer" | "supplier") */
export default function PartiesPage({ mode }) {
  const isCustomer = mode === "customer";
  const base = isCustomer ? "/customers" : "/suppliers";
  const label = isCustomer ? "Customer" : "Supplier";

  const toast = useToast();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, loading, refetch } = useFetch(
    () => api.get(base, { params: { search: search || undefined } }).then((r) => r.data.data),
    [search, mode]
  );

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
      if (editItem) await api.put(`${base}/${editItem.id}`, form);
      else await api.post(base, form);
      toast.success(`${label} ${editItem ? "updated" : "created"}`);
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

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner className="block mx-auto my-14" />
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
                  <tr key={item.id} className="hover:bg-slate-50/60">
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
            await api.delete(`${base}/${deleteTarget.id}`);
            toast.success(`${label} deleted`);
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
