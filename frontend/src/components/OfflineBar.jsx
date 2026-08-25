import { useEffect, useState } from "react";
import { WifiOff, CloudUpload, Loader2 } from "lucide-react";
import { subscribe, queueSize, flushQueue } from "../services/offlineQueue";
import { useToast } from "../context/ToastContext";

export default function OfflineBar() {
  const toast = useToast();
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(queueSize());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsub = subscribe(setPending);
    const goOffline = () => setOnline(false);
    const goOnline = () => setOnline(true);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    const onSynced = (e) => {
      toast.success(
        `Synced ${e.detail.synced} offline ${e.detail.synced === 1 ? "operation" : "operations"}`
      );
    };
    window.addEventListener("bh-offline-synced", onSynced);
    return () => {
      unsub();
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("bh-offline-synced", onSynced);
    };
  }, [toast]);

  if (online && !pending) return null;

  const sync = async () => {
    setSyncing(true);
    try {
      const { synced, remaining } = await flushQueue();
      if (synced) toast.success(`Synced ${synced} offline ${synced === 1 ? "operation" : "operations"}`);
      if (remaining) toast.error(`${remaining} operations still pending`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-sm font-medium text-white ${
        online ? "bg-amber-500" : "bg-slate-800"
      }`}
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>{online ? "Back online" : "You're offline — browsing cached data"}</span>
      {pending > 0 && (
        <>
          <span className="opacity-80">
            {pending} {pending === 1 ? "operation" : "operations"} waiting to sync
          </span>
          <button
            onClick={sync}
            disabled={syncing || !online}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-50 px-2.5 py-1 text-xs font-semibold"
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CloudUpload className="w-3.5 h-3.5" />
            )}
            Sync now
          </button>
        </>
      )}
    </div>
  );
}
