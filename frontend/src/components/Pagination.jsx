import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
      <p className="text-xs text-slate-500">
        Page {meta.page} of {meta.totalPages} · {meta.total} records
      </p>
      <div className="flex gap-2">
        <button
          className="btn-secondary !px-2.5 !py-1.5"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          className="btn-secondary !px-2.5 !py-1.5"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
