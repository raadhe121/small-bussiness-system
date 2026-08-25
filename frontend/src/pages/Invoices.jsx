import { useState } from "react";
import { TableSkeleton, CardGridSkeleton } from "../components/Skeleton";
import { Link, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
import api, { errMsg } from "../services/api";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import SearchInput from "../components/SearchInput";

import EmptyState from "../components/EmptyState";
import useSelection from "../hooks/useSelection";
import BulkDeleteBar from "../components/BulkDeleteBar";
import { inr, fmtDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

export default function Invoices() {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = hasPermission(user?.role, "sales:manage");
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const [search_, setSearch_] = useState(search);
  const [q, setQ] = useState(search);

  const { data, loading, refetch } = useFetch(
    () => api.get("/sales", { params: { search: q || undefined, limit: 20 } }).then((r) => r.data.data),
    [q]
  );
  const items = data?.items || [];
  const selection = useSelection(items);

  const handleBulkDelete = async () => {
    try {
      const res = await api.delete("/sales/bulk", { data: { ids: selection.selectedIds } });
      const { deleted, failed } = res.data.data || {};
      toast.success(`Deleted ${deleted || 0} invoices${failed?.length ? `, ${failed.length} skipped` : ""}`);
      selection.clear();
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div>
      <PageHeader title="Invoices" subtitle="All sales invoices" />

      <SearchInput
        className="sm:max-w-xs mb-4"
        value={search_}
        onChange={(v) => {
          setSearch_(v);
          setParams(v ? { search: v } : {});
          // debounce
          clearTimeout(window.__invT);
          window.__invT = setTimeout(() => setQ(v), 300);
        }}
        placeholder="Search invoice number or customer..."
      />

      <BulkDeleteBar count={selection.count} label="invoices" onDelete={handleBulkDelete} onClear={selection.clear} />

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : data.items.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th w-10">
                      <input type="checkbox" checked={selection.allSelected} onChange={(e) => selection.toggleAll(e.target.checked)} aria-label="Select all" />
                    </th>
                    <th className="th">Invoice #</th>
                    <th className="th">Customer</th>
                    <th className="th">Date</th>
                    <th className="th text-right">Total</th>
                    <th className="th text-right">Paid</th>
                    <th className="th text-right">Due</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((s) => (
                    <tr key={s.id} className={selection.has(s.id) ? "hover:bg-slate-50/60 bg-brand-50/40" : "hover:bg-slate-50/60"}>
                      <td className="td">
                        <input type="checkbox" checked={selection.has(s.id)} onChange={() => selection.toggle(s.id)} aria-label="Select row" />
                      </td>
                      <td className="td font-semibold">{s.invoiceNo}</td>
                    <td className="td">{s.customer?.name || <span className="text-slate-400">Walk-in</span>}</td>
                    <td className="td">{fmtDate(s.saleDate)}</td>
                    <td className="td text-right font-semibold">{inr(s.grandTotal)}</td>
                    <td className="td text-right text-emerald-600">{inr(s.paidAmount)}</td>
                    <td className={`td text-right font-medium ${s.dueAmount > 0 ? "text-red-500" : "text-slate-400"}`}>{inr(s.dueAmount)}</td>
                    <td className="td">
                      <Link to={`/invoices/${s.id}`} className="btn-secondary !py-1.5 !px-3 text-xs ml-auto flex w-fit">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
