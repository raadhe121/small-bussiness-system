import { useState } from "react";
import { Trash2, X } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";

/**
 * Sticky action bar shown when rows are selected. Confirms before calling onDelete.
 */
export default function BulkDeleteBar({ count, label = "items", onDelete, onClear, busy = false }) {
  const [confirm, setConfirm] = useState(false);

  if (count === 0) return null;

  const doDelete = async () => {
    setConfirm(false);
    await onDelete();
  };

  return (
    <>
      <div className="sticky top-4 z-20 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 shadow-lg backdrop-blur mb-4">
        <div className="text-sm font-medium text-red-700">
          {count} {label} selected
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary" onClick={onClear} disabled={busy}>
            <X className="w-4 h-4" /> Clear
          </button>
          <button type="button" className="btn-danger" onClick={() => setConfirm(true)} disabled={busy}>
            <Trash2 className="w-4 h-4" /> Delete selected
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        danger
        title={`Delete ${count} ${label}?`}
        message="This action cannot be undone. Rows referenced by other records (e.g. products with sales history) will be skipped."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
