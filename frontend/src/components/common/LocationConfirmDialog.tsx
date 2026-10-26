import { useEffect, useState } from "react";
import { MapPin, AlertTriangle, RefreshCw, CheckCircle2, X } from "lucide-react";
import { useGps } from "../../lib/hooks/useGps";

interface ILocationConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (location: { latitude: number; longitude: number; accuracy: number }) => void;
  label: string;
}

// check-in / check-out confirmation dialog - har choti fresh GPS lincha
export default function LocationConfirmDialog({ open, onClose, onConfirm, label }: ILocationConfirmDialogProps) {
  const gps = useGps();
  const [loc, setLoc] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // dialog kholo ki sathi GPS linne
  useEffect(() => {
    if (!open) {
      setLoc(null);
      setRetryCount(0);
      return;
    }
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, retryCount]);

  const requestLocation = async () => {
    try {
      const position = await gps.getLocation();
      setLoc(position);
    } catch {
      setLoc(null);
    }
  };

  const handleRetry = () => {
    setLoc(null);
    setRetryCount((c) => c + 1);
  };

  if (!open) return null;

  const accuracy = loc?.accuracy;
  const accuracyLabel =
    accuracy == null
      ? null
      : accuracy <= 30
        ? { text: `${Math.round(accuracy)}m — Excellent`, color: "text-emerald-600 bg-emerald-50 border-emerald-200" }
        : accuracy <= 100
          ? { text: `${Math.round(accuracy)}m — Good`, color: "text-blue-600 bg-blue-50 border-blue-200" }
          : accuracy <= 200
            ? { text: `${Math.round(accuracy)}m — Fair`, color: "text-amber-600 bg-amber-50 border-amber-200" }
            : { text: `${Math.round(accuracy)}m — Poor`, color: "text-red-600 bg-red-50 border-red-200" };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* dialog */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-base font-bold text-slate-900">{label}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="px-5 pb-5 space-y-4">
          {gps.loading && !loc ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin size={20} className="text-primary animate-pulse" />
              </div>
              <p className="text-sm text-slate-600">Getting your location…</p>
              <p className="text-xs text-slate-400">Make sure GPS / high-accuracy location is turned on</p>
            </div>
          ) : gps.error && !loc ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <p className="text-sm text-red-600 text-center leading-relaxed">{gps.error}</p>
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : loc && accuracyLabel ? (
            <>
              {/* accuracy badge */}
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium ${accuracyLabel.color}`}>
                <MapPin size={14} />
                GPS Accuracy: {accuracyLabel.text}
              </div>

              {accuracy != null && accuracy > 150 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Accuracy is low. Try going near a window, outdoors, or enabling High-accuracy mode in phone settings. You can retry.
                </p>
              )}

              {/* confirm / retry buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw size={14} /> Retry Location
                </button>
                <button
                  onClick={() => onConfirm(loc)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-sm"
                >
                  <CheckCircle2 size={15} /> Confirm
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
