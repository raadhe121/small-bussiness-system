import { Link } from "react-router-dom";
import { ArrowDownToLine, Plus, Eye } from "lucide-react";
import api from "../services/api";
import useFetch from "../hooks/useFetch";
import PageHeader from "../components/PageHeader";
import SearchInput from "../components/SearchInput";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { inr, fmtDate } from "../utils/format";

export default function Purchases() {
  const [search, setSearch] = useState("");
  const { data, loading } = useFetch(
    () => api.get("/purchases", { params: { search: search || undefined, limit: 15 } }).then((r) => r.data.data),
    [search]
  );

  return (
    <div>
      <PageHeader
        title="Purchases"
        actions={<Link to="/purchases/new" className="btn-primary"><Plus className="w-4 h-4" /> New Purchase</Link>}
      />

      <SearchInput className="sm:max-w-xs mb-4" value={search} onChange={setSearch} placeholder="Search bill or supplier..." />

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner className="block mx-auto my-14" />
        ) : data.items.length === 0 ? (
          <EmptyState icon={ArrowDownToLine} title="No purchases yet" action={<Link to="/purchases/new" className="btn-primary"><Plus className="w-4 h-4" /> New Purchase</Link>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th">Bill</th>
                    <th className="th">Supplier</th>
                    <th className="th">Date</th>
                    <th className="th">Method</th>
                    <th className="th text-right">Total</th>
                    <th className="th text-right">Due</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="td font-semibold">{p.billNo || "—"}</td>
                      <td className="td">{p.supplier?.name || <span className="text-slate-400">—</span>}</td>
                      <td className="td">{fmtDate(p.purchaseDate)}</td>
                      <td className="td"><span className="badge bg-slate-100 text-slate-600">{String(p.paymentMethod).replace("_", " ")}</span></td>
                      <td className="td text-right font-semibold">{inr(p.grandTotal)}</td>
                      <td className={`td text-right font-medium ${p.dueAmount > 0 ? "text-red-500" : "text-slate-400"}`}>{inr(p.dueAmount)}</td>
                      <td className="td"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={data.meta} onPage={() => {}} />
          </>
        )}
      </div>
    </div>
  );
}
