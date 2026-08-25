import { useState } from "react";
import { TableSkeleton, CardGridSkeleton } from "../components/Skeleton";
import { Link } from "react-router-dom";
import { Wallet, Plus } from "lucide-react";
import api, { errMsg } from "../services/api";
import { submitOrQueue } from "../services/offlineQueue";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import SearchInput from "../components/SearchInput";
import Modal from "../components/Modal";

import EmptyState from "../components/EmptyState";
import useSelection from "../hooks/useSelection";
import BulkDeleteBar from "../components/BulkDeleteBar";
import { inr, fmtDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

const METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER"];

export default function Payments() {
  const toast = useToast();
  const { user } = useAuth();
  const canCreate = hasPermission(user?.role, "payments:create");
  const canManage = hasPermission(user?.role, "payments:manage");
  const [tab, setTab] = useState("customer");
  const [search, setSearch] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ partyId: "", amount: "", method: "CASH", reference: "", notes: "" });

  const isCustomer = tab === "customer";
  const { data, loading, refetch } = useFetch(
    () => api.get("/payments", { params: { partyType: tab.toUpperCase(), search: search || undefined } }).then((r) => r.data.data),
    [tab, search]
  );
  const items = data?.items || [];
  const selection = useSelection(items);

  const handleBulkDelete = async () => {
    try {
      const res = await api.delete("/payments/bulk", { data: { ids: selection.selectedIds } });
      const { deleted, failed } = res.data.data || {};
      toast.success(`Deleted ${deleted || 0} payments${failed?.length ? `, ${failed.length} skipped` : ""}`);
      selection.clear();
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  const { data: parties } = useFetch(
    () => api.get(isCustomer ? "/customers" : "/suppliers", { params: { limit: 100 } }).then((r) => r.data.data.items),
    [isCustomer]
  );

  const withDue = (parties || []).filter((p) => Number(p.outstanding) > 0);
  const selected = withDue.find((p) => p.id === form.partyId);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...(isCustomer ? { customerId: form.partyId } : { supplierId: form.partyId }),
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      };
      const result = await submitOrQueue({ label: "Payment", url: `/payments/${tab}`, method: "POST", body: payload });
      if (result.queued) {
        toast.success("You're offline — payment queued and will sync automatically");
      } else {
        toast.success("Payment recorded");
      }
      setPayOpen(false);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Money received from customers and paid to suppliers"
        actions={canCreate && <button className="btn-primary" onClick={() => { setForm({ partyId: "", amount: "", method: "CASH", reference: "", notes: "" }); setPayOpen(true); }}><Plus className="w-4 h-4" /> Record Payment</button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="inline-flex rounded-lg bg-slate-200/70 p-1 w-fit">
          {[["customer", "Received"], ["supplier", "Paid"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === key ? "bg-white shadow text-brand-700" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <SearchInput className="sm:max-w-xs flex-1" value={search} onChange={setSearch} placeholder="Search reference..." />
      </div>

      <BulkDeleteBar count={selection.count} label="payments" onDelete={handleBulkDelete} onClear={selection.clear} />

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments yet" subtitle="Recorded payments appear here." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th w-10">
                      <input type="checkbox" checked={selection.allSelected} onChange={(e) => selection.toggleAll(e.target.checked)} aria-label="Select all" />
                    </th>
                    <th className="th">Date</th>
                    <th className="th">Party</th>
                    <th className="th">Branch</th>
                    <th className="th">Method</th>
                    <th className="th">Reference</th>
                    <th className="th text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((p) => (
                    <tr key={p.id} className={selection.has(p.id) ? "hover:bg-slate-50/60 bg-brand-50/40" : "hover:bg-slate-50/60"}>
                      <td className="td">
                        <input type="checkbox" checked={selection.has(p.id)} onChange={() => selection.toggle(p.id)} aria-label="Select row" />
                      </td>
                      <td className="td">{fmtDate(p.paymentDate)}</td>
                      <td className="td font-medium">
                        {p.customer || p.supplier ? (
                          <Link className="hover:text-brand-600" to={isCustomer ? `/customers/${p.customer?.id}` : `/suppliers/${p.supplier?.id}`}>
                            {p.customer?.name || p.supplier?.name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="td text-slate-500">{p.branchName || "—"}</td>
                      <td className="td"><span className="badge bg-blue-50 text-blue-700">{String(p.method).replace("_", " ")}</span></td>
                      <td className="td text-slate-500">{p.reference || p.notes || "—"}</td>
                      <td className={`td text-right font-bold ${isCustomer ? "text-emerald-600" : "text-red-500"}`}>{inr(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 text-sm">
              Total in view: <b>{inr(data.summary.totalAmount)}</b>
            </div>
          </>
        )}
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={isCustomer ? "Receive payment from customer" : "Pay supplier"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">{label()} *</label>
            <select required className="input" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
              <option value="">Select {isCustomer ? "customer" : "supplier"} with outstanding due</option>
              {withDue.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — due {inr(p.outstanding)}</option>
              ))}
            </select>
            {withDue.length === 0 && (
              <p className="text-xs text-slate-400 mt-1.5">
                No parties have outstanding balances. Dues are created by credit sales/purchases.
              </p>
            )}
          </div>
          {selected && (
            <p className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600">
              Outstanding: <b>{inr(selected.outstanding)}</b>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (₹) *</label>
              <input required type="number" min="0.01" step="0.01" max={selected ? Number(selected.outstanding) : undefined} className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Reference</label>
            <input className="input" placeholder="UPI txn id / cheque no." value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setPayOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving || !form.partyId}>{saving ? "Saving..." : "Save payment"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const label = () => "Party";
