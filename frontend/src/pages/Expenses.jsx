import { useState } from "react";
import { ReceiptIndianRupee, Plus, Pencil, Trash2 } from "lucide-react";
import api, { errMsg } from "../services/api";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import SearchInput from "../components/SearchInput";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { inr, fmtDate, toInputDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

const emptyForm = {
  expenseCategoryId: "", amount: "", method: "CASH",
  reference: "", description: "", expenseDate: toInputDate(),
};

export default function Expenses() {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = hasPermission(user?.role, "expenses:manage");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [catName, setCatName] = useState("");

  const { data, loading, refetch } = useFetch(
    () => api.get("/expenses", { params: { search: search || undefined } }).then((r) => r.data.data),
    [search]
  );
  const { data: categories, refetch: refetchCategories } = useFetch(
    () => api.get("/expenses/categories").then((r) => r.data.data),
    []
  );

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...emptyForm, expenseCategoryId: categories?.[0]?.id || "" });
    setShowForm(true);
  };

  const openEdit = (e) => {
    setEditItem(e);
    setForm({
      expenseCategoryId: e.expenseCategory.id,
      amount: e.amount,
      method: e.method,
      reference: e.reference || "",
      description: e.description || "",
      expenseDate: toInputDate(e.expenseDate),
    });
    setShowForm(true);
  };

  const save = async (ev) => {
    ev.preventDefault();
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        expenseDate: new Date(`${form.expenseDate}T12:00:00Z`).toISOString(),
      };
      if (editItem) await api.put(`/expenses/${editItem.id}`, payload);
      else await api.post("/expenses", payload);
      toast.success(editItem ? "Expense updated" : "Expense recorded");
      setShowForm(false);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const addCategory = async () => {
    if (!catName.trim()) return;
    try {
      await api.post("/expenses/categories", { name: catName.trim() });
      setCatName("");
      refetchCategories();
      toast.success("Category added");
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={data?.summary ? `Total in view: ${inr(data.summary.totalAmount)}` : undefined}
        actions={canManage && <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add Expense</button>}
      />

      <SearchInput className="sm:max-w-xs mb-4" value={search} onChange={setSearch} placeholder="Search expenses..." />

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner className="block mx-auto my-14" />
        ) : data.items.length === 0 ? (
          <EmptyState icon={ReceiptIndianRupee} title="No expenses yet" subtitle="Track rent, salaries, transport and more." action={canManage && <button className="btn-primary" onClick={openCreate}>Add Expense</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Category</th>
                    <th className="th">Description</th>
                    <th className="th">Method</th>
                    <th className="th text-right">Amount</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60">
                      <td className="td">{fmtDate(e.expenseDate)}</td>
                      <td className="td"><span className="badge bg-brand-50 text-brand-700">{e.expenseCategory.name}</span></td>
                      <td className="td text-slate-500 max-w-xs truncate">{e.description || e.reference || "—"}</td>
                      <td className="td">{String(e.method).replace("_", " ")}</td>
                      <td className="td text-right font-semibold text-red-500">{inr(e.amount)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          {canManage && (
                            <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
                          )}
                          <button onClick={() => setDeleteTarget(e)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 text-sm">
              Total in view: <b className="text-red-500">{inr(data.summary.totalAmount)}</b>
            </div>
          </>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? "Edit expense" : "Add expense"}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category *</label>
              <select required className="input" value={form.expenseCategoryId} onChange={(e) => setForm({ ...form, expenseCategoryId: e.target.value })}>
                <option value="">Select...</option>
                {(categories || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount (₹) *</label>
              <input required type="number" min="0.01" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Payment method</label>
              <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"].map((m) => <option key={m}>{m.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input required type="date" className="input" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Reference / receipt no.</label>
            <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={2} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary">Save</button>
          </div>
        </form>

        {/* Quick add category */}
        {!editItem && categories && (
          <div className="mt-5 pt-4 border-t border-slate-200 flex gap-2">
            <input
              className="input flex-1"
              placeholder="New category name..."
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
            />
            <button type="button" onClick={addCategory} className="btn-secondary">+ Category</button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title="Delete this expense?"
        message={`Amount ${deleteTarget ? inr(deleteTarget.amount) : ""} — this cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          try {
            await api.delete(`/expenses/${deleteTarget.id}`);
            toast.success("Expense deleted");
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
