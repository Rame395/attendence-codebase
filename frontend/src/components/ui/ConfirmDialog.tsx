import { useEffect, useState } from "react";
import { AlertTriangle, Trash2, ShieldAlert, X } from "lucide-react";

type Variant = "danger" | "sensitive";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  /** Name of the item being deleted, shown highlighted */
  itemName?: string;
  /** Bullet list of consequences */
  details?: string[];
  variant?: Variant;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  /** Word that must be typed to confirm (default DELETE). Only for sensitive. */
  confirmWord?: string;
}

/** Reusable confirmation dialog */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  details,
  variant = "danger",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isLoading = false,
  confirmWord = "DELETE",
}: ConfirmDialogProps) {
  const isSensitive = variant === "sensitive";
  const [agreed, setAgreed] = useState(false);
  const [typed, setTyped] = useState("");

  // reset when opened/closed or variant changes
  useEffect(() => {
    if (open) {
      setAgreed(false);
      setTyped("");
    }
  }, [open, variant]);

  // ESC to close, lock body scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, isLoading]);

  if (!open) return null;

  const canConfirm = isSensitive ? agreed && typed.trim() === confirmWord : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isLoading && onClose()}
        aria-hidden
      />

      {/* card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-border animate-in max-h-[90dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div
            className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
              isSensitive ? "bg-red-50 text-red-600" : "bg-red-50 text-red-600"
            }`}
          >
            {isSensitive ? <ShieldAlert size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-title" className="text-base font-bold text-slate-900 leading-tight">
              {title}
            </h3>
            {description && (
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="shrink-0 p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="px-6 pb-2 space-y-4 overflow-y-auto">
          {/* item name highlight */}
          {itemName && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">You are about to delete</p>
              <p className="mt-1 text-sm font-bold text-slate-900 break-all">{itemName}</p>
            </div>
          )}

          {/* details / consequences */}
          {details && details.length > 0 && (
            <div className="rounded-xl bg-amber-50/70 border border-amber-200 px-4 py-3">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={12} /> This will
              </p>
              <ul className="mt-2 space-y-1.5">
                {details.map((d, i) => (
                  <li key={i} className="flex gap-2 text-sm text-amber-900/80 leading-snug">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* sensitive: agreement */}
          {isSensitive && (
            <div className="space-y-4 pt-2">
              <label className="flex gap-3 p-3 rounded-xl border border-red-200 bg-red-50/50 cursor-pointer hover:bg-red-50 transition-colors">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-red-600 accent-red-600 shrink-0"
                  disabled={isLoading}
                />
                <span className="text-sm text-slate-700 leading-snug">
                  I understand this action is <span className="font-bold text-red-700">permanent</span> and{" "}
                  <span className="font-bold">cannot be undone</span>. I agree to permanently delete this record
                  and all associated data.
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Type <span className="font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">{confirmWord}</span> to confirm
                </label>
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={confirmWord}
                  autoComplete="off"
                  autoFocus
                  disabled={isLoading}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all placeholder:text-slate-400"
                />
                {typed && typed.trim() !== confirmWord && (
                  <p className="mt-1.5 text-xs text-red-500">Please type exactly {confirmWord} to enable deletion.</p>
                )}
              </div>
            </div>
          )}

          {/* danger variant hint */}
          {!isSensitive && (
            <p className="text-xs text-slate-400">This action cannot be undone.</p>
          )}
        </div>

        {/* footer */}
        <div className="flex gap-3 p-6 pt-4 bg-white border-t border-slate-100 mt-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || !canConfirm}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-lg shadow-red-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
