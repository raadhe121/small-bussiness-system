import { useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCancel?.();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCancel} />
      <div className="relative card max-w-sm w-full p-6 animate-fade">
        <button onClick={onCancel} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-start gap-4">
          {danger && (
            <div className="rounded-full bg-red-50 p-2.5">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            {message && <p className="mt-1.5 text-sm text-slate-500">{message}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className={danger ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
