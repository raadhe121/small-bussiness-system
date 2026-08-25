import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

let deferredPrompt = null;
const listeners = new Set();
const DISMISS_KEY = "bh_install_dismissed";

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  listeners.forEach((fn) => fn(true));
});

export default function InstallPrompt() {
  const [installable, setInstallable] = useState(!!deferredPrompt);
  const [hidden, setHidden] = useState(localStorage.getItem(DISMISS_KEY) === "1");
  const [standalone] = useState(
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone
  );

  useEffect(() => {
    const fn = (available) => setInstallable(available);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  if (!installable || hidden || standalone) return null;

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    setInstallable(false);
    listeners.forEach((fn) => fn(false));
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <img src="/icons/icon-192.png" alt="BusinessHub" className="w-9 h-9 rounded-lg" />
      <div className="text-sm">
        <p className="font-semibold text-slate-800">Install BusinessHub</p>
        <p className="text-xs text-slate-500">Works offline, right from your home screen</p>
      </div>
      <button
        onClick={install}
        className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white"
      >
        <Download className="w-3.5 h-3.5" /> Install
      </button>
      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setHidden(true);
        }}
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
