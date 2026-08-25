import { useState } from "react";
import { Percent, FileSpreadsheet } from "lucide-react";
import api from "../services/api";
import useFetch from "../hooks/useFetch";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import { inr } from "../utils/format";

const PRESETS = [["this_month", "This month"], ["today", "Today"], ["this_week", "This week"]];

function toISO(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function GST() {
  const [preset, setPreset] = useState("this_month");
  const [from, setFrom] = useState(toISO(new Date(Date.now() - 90 * 86400000)));
  const [to, setTo] = useState(toISO(new Date()));
  const params = preset === "custom" ? { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` } : { preset };

  const { data, loading } = useFetch(() => api.get("/gst/summary", { params }).then((r) => r.data.data), [preset, from, to]);

  return (
    <div>
      <PageHeader title="GST Summary" subtitle="Output tax on sales and input tax credit on purchases" />

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-2">
        <Percent className="w-4 h-4 text-slate-400" />
        {PRESETS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setPreset(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === v ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {l}
          </button>
        ))}
        <button
          onClick={() => setPreset("custom")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === "custom" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Custom quarter
        </button>
        {preset === "custom" && (
          <>
            <input type="date" className="input !w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" className="input !w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
      </div>

      {loading ? (
        <Spinner className="block mx-auto my-16" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <Box label="Taxable sales (output)" value={inr(data.taxableSales)} />
            <Box label="CGST collected" value={inr(data.outputTax.cgst)} tone="text-brand-700" />
            <Box label="SGST collected" value={inr(data.outputTax.sgst)} tone="text-brand-700" />
            <Box label="IGST collected" value={inr(data.outputTax.igst)} tone="text-brand-700" />
            <Box label="Total output tax" value={inr(data.outputTax.total)} />
            <Box label="Input tax credit (purchases)" value={inr(data.inputTaxCredit.total)} tone="text-emerald-600" />
          </div>

          <div className="card p-6 mb-5">
            <p className="text-sm text-slate-500">Net GST payable (output − input credit)</p>
            <p className={`text-3xl font-extrabold mt-1 ${data.netPayable >= 0 ? "text-red-500" : "text-emerald-600"}`}>
              {inr(Math.abs(data.netPayable))} {data.netPayable >= 0 ? "" : "credit"}
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm">Rate-wise summary</h2>
              <FileSpreadsheet className="w-4 h-4 text-slate-400" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th">GST rate</th>
                    <th className="th text-right">Taxable amount</th>
                    <th className="th text-right">Tax amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rateWise.length === 0 ? (
                    <tr><td colSpan={3} className="td text-center text-slate-400 py-8">No taxable sales in this period</td></tr>
                  ) : (
                    data.rateWise.map((r) => (
                      <tr key={r.taxRate}>
                        <td className="td font-semibold">{r.taxRate}%</td>
                        <td className="td text-right">{inr(r.taxableAmount)}</td>
                        <td className="td text-right font-medium">{inr(r.taxAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-4 max-w-2xl">
            Note: This is an informational summary computed from your recorded transactions.
            BusinessHub does not file GST returns or connect to the GSTN portal — export these
            figures to your CA / filing software.
          </p>
        </>
      )}
    </div>
  );
}

function Box({ label, value, tone = "text-slate-800" }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${tone}`}>{value}</p>
    </div>
  );
}
