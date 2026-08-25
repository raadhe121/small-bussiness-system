import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, Camera, Keyboard } from "lucide-react";

/**
 * Live camera barcode scanner for the POS.
 * Uses the device camera via @zxing/browser and reports each decoded value
 * through `onDetect`. Multiple scans are allowed (so a cashier can scan a
 * basket item-by-item); identical codes within 1.2s are ignored to avoid
 * double-adding a product that's held still in front of the lens.
 */
export default function BarcodeScanner({ onDetect, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const lastRef = useRef({ code: "", at: 0 });
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!result) return;
            const code = result.getText();
            const now = Date.now();
            if (code === lastRef.current.code && now - lastRef.current.at < 1200) return;
            lastRef.current = { code, at: now };
            onDetect(code);
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        if (cancelled) return;
        const msg = e?.message || "";
        setError(
          /permission|denied|notallowed/i.test(msg)
            ? "Camera permission was denied. Allow camera access, or enter the barcode manually."
            : "Could not start the camera. Enter the barcode manually below."
        );
      }
    })();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {
        /* noop */
      }
    };
  }, [onDetect]);

  const submitManual = () => {
    const code = manual.trim();
    if (code) onDetect(code);
    setManual("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative card w-full max-w-md overflow-hidden animate-fade">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Camera className="w-4 h-4 text-brand-600" /> Scan barcode
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {error ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 mb-4">
              {error}
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-4">
              <video ref={videoRef} className="w-full h-full object-cover" />
              <div className="absolute inset-0 pointer-events-none ring-2 ring-brand-400/70 m-10 rounded-lg" />
            </div>
          )}

          <label className="label flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" /> Or enter barcode manually
          </label>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="e.g. 8901234567890"
              value={manual}
              autoFocus
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitManual()}
            />
            <button className="btn-secondary shrink-0" onClick={submitManual}>
              Add
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Point the camera at a product barcode. The matching product is added to the bill automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
