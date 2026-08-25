import { useState } from "react";
import {
  BarChart3, ShoppingCart, ArrowDownToLine, TrendingUp,
  ReceiptIndianRupee, Boxes, Wallet, Users2, Truck,
} from "lucide-react";
import api from "../services/api";
import useFetch from "../hooks/useFetch";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import { inr } from "../utils/format";

const TABS = [
  ["sales", "Sales", ShoppingCart],
  ["purchases", "Purchases", ArrowDownToLine],
  ["profit", "Profit & Loss", TrendingUp],
  ["expenses", "Expenses", ReceiptIndianRupee],
  ["inventory", "Inventory", Boxes],
  ["outstanding", "Outstanding", Users2],
  ["payments", "Payments", Wallet],
];

const PRESETS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["this_week", "This week"],
  ["this_month", "This month"],
  ["custom", "Custom"],
];

function toISO(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Reports() {
  const [tab, setTab] = useState("sales");
  const [preset, setPreset] = useState("this_month");
  const [from, setFrom] = useState(toISO(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(toISO(new Date()));

  const rangeParams = preset === "custom" ? { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` } : { preset };

  const { data, loading } = useFetch(
    () => api.get(`/reports/${tab}`, { params: rangeParams }).then((r) => r.data.data),
    [tab, preset, from, to]
  );

  return (
    <div>
      <PageHeader title="Reports" subtitle="Business insights from real transaction data" />

      <div className="card p-4 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-400 mr-1" />
          <select className="input !w-auto" value={tab} onChange={(e) => setTab(e.target.value)}>
            {TABS.map(([v, l]) => <option key={v} value={v}>{l} report</option>)}
          </select>
          <span className="text-slate-300">|</span>
          {PRESETS.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setPreset(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                preset === v ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {l}
            </button>
          ))}
          {preset === "custom" && (
            <>
              <input type="date" className="input !w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-slate-400 text-sm">to</span>
              <input type="date" className="input !w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner className="block mx-auto my-16" />
      ) : (
        <div className="space-y-4">
          {tab === "sales" && data?.summary && (
            <>
              <StatGrid stats={[
                ["Total sales", inr(data.summary.totalSales)],
                ["Collected", inr(data.summary.collected)],
                ["Outstanding", inr(data.summary.outstanding)],
                ["GST collected", inr(data.summary.tax)],
                ["Discounts given", inr(data.summary.discounts)],
                ["Invoices", data.summary.orderCount],
              ]} />
              {data.byDay.length > 0 && (
                <Table
                  head={["Date", "Orders", "Sales"]}
                  rows={data.byDay.map((d) => [d.date, d.orders, inr(d.total)])}
                />
              )}
              {data.topProducts.length > 0 && (
                <Table head={["Top product", "Qty sold", "Revenue"]} rows={data.topProducts.map((t) => [t.productName, t.quantity, inr(t.revenue)])} title="Best sellers (in period)" />
              )}
            </>
          )}

          {tab === "purchases" && data?.summary && (
            <StatGrid stats={[
              ["Total purchases", inr(data.summary.totalPurchases)],
              ["Paid", inr(data.summary.paid)],
              ["Outstanding", inr(data.summary.outstanding)],
              ["Input GST", inr(data.summary.tax)],
              ["Bills", data.summary.billCount],
            ]} />
          )}

          {tab === "profit" && data && (
            <StatGrid stats={[
              ["Revenue (incl. tax)", inr(data.revenue)],
              ["Net sales (taxable)", inr(data.netSales)],
              ["Cost of goods sold", inr(data.cogs)],
              ["Gross profit", inr(data.grossProfit), data.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"],
              ["Operating expenses", inr(data.operatingExpenses)],
              ["Net profit", inr(data.netProfit), data.netProfit >= 0 ? "text-emerald-600 font-extrabold" : "text-red-600 font-extrabold"],
            ]} />
          )}

          {tab === "expenses" && data && (
            <>
              <StatGrid stats={[["Total expenses", inr(data.total)]]} />
              <Table head={["Category", "Entries", "Amount"]} rows={data.byCategory.map((c) => [c.category, c.count, inr(c.amount)])} />
            </>
          )}

          {tab === "inventory" && data && (
            <Table
              head={["Product", "SKU", "Stock", "Stock value"]}
              rows={data.items.map((i) => [
                i.name + (i.isLowStock ? " ⚠" : ""),
                i.sku,
                `${i.quantity}`,
                inr(i.stockValue),
              ])}
              footer={`Total stock value: ${inr(data.stockValue)}`}
            />
          )}

          {tab === "outstanding" && data && (
            <>
              <StatGrid stats={[
                ["Receivable (customers)", inr(data.totals.receivable), "text-emerald-600"],
                ["Payable (suppliers)", inr(data.totals.payable), "text-red-500"],
              ]} />
              <Table head={["Customer", "Phone", "Outstanding"]} rows={data.customers.map((c) => [c.name, c.phone, inr(c.outstanding)])} title="Customers owing money" emptyText="No outstanding receivables 🎉" />
              <Table head={["Supplier", "Phone", "Outstanding"]} rows={data.suppliers.map((s) => [s.name, s.phone, inr(s.outstanding)])} title="Suppliers to pay" emptyText="No outstanding payables" />
            </>
          )}

          {tab === "payments" && data && (
            <>
              <StatGrid stats={[["Total payments in period", inr(data.total)]]} />
              <Table head={["Direction", "Method", "Count", "Amount"]} rows={data.breakdown.map((b) => [b.partyType === "CUSTOMER" || b.partyType === "SALE" ? "Received" : "Paid", String(b.method).replace("_", " "), b.count, inr(b.amount)])} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatGrid({ stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {stats.map(([label, value, tone]) => (
        <div key={label} className="card p-4">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className={`text-lg font-bold mt-1 ${tone || "text-slate-800"}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function Table({ head, rows, title, footer, emptyText = "No data for this period" }) {
  return (
    <div className="card overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-sm text-slate-700">{title}</h2>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>{head.map((h, i) => <th key={h} className={`th ${i > 0 ? "text-right" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={head.length} className="td text-center text-slate-400 py-8">{emptyText}</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  {r.map((c, j) => <td key={j} className={`td ${j > 0 ? "text-right font-medium" : ""}`}>{c}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer && <div className="px-4 py-3 border-t border-slate-200 text-sm font-semibold">{footer}</div>}
    </div>
  );
}
