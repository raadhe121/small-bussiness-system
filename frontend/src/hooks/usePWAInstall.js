import { useEffect, useState, useCallback } from "react";

/**
 * Drives the "Install app" experience.
 * - On Android/Chrome the browser fires `beforeinstallprompt`; we capture it so
 *   we can trigger the native install dialog from a real button tap.
 * - On iOS Safari that event never fires, so we surface manual
 *   "Share → Add to Home Screen" instructions instead.
 */
export function usePWAInstall() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent || "") &&
    !window.MSStream;

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome === "accepted";
  }, [deferred]);

  return { canInstall: Boolean(deferred), isIOS, installed, install };
}
