import { useState } from "react";
import { Download, X, Share2 } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

/**
 * In-app prompt that lets users install the PWA. Renders nothing when the
 * browser can't install (e.g. already installed, or a desktop without support).
 * On iOS it shows the manual "Add to Home Screen" steps since there is no
 * programmatic install API.
 */
export default function InstallPrompt() {
  const { canInstall, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (!canInstall && !isIOS)) return null;

  const onInstall = async () => {
    const accepted = await install();
    if (accepted) setDismissed(true);
  };

  return (
    <div className="w-full max-w-md mx-auto mb-4 rounded-2xl border border-white/70 bg-white/95 backdrop-blur px-4 py-3 shadow-lg flex items-center gap-3">
      <div className="rounded-xl bg-brand-100 text-brand-600 p-2 shrink-0">
        {isIOS ? <Share2 className="w-5 h-5" /> : <Download className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">
          {isIOS ? "Add BusinessHub to your Home Screen" : "Install the BusinessHub app"}
        </p>
        <p className="text-xs text-slate-500">
          {isIOS
            ? "Tap Share, then “Add to Home Screen”."
            : "Faster access & offline billing — no app store needed."}
        </p>
      </div>
      {!isIOS && (
        <button onClick={onInstall} className="btn-primary !py-1.5 text-xs shrink-0">
          Install
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="text-slate-400 hover:text-slate-600 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
