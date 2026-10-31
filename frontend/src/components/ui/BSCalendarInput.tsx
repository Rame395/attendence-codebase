import { useRef, useState, useId } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, X, ArrowRightLeft } from "lucide-react";
import BSCalendar from "./BSCalendar";
import { toBS, toBSEnglish, toLocalDateInput } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import { useModalAccessibility } from "../../lib/hooks/useModalAccessibility";

/** Convert Date → "YYYY-MM-DD" (local day, no UTC shift) for native `<input type="date">`. */
function toADInputValue(d: Date): string {
  return toLocalDateInput(d);
}

/** Convert "YYYY-MM-DD" → Date (avoids timezone shift). */
function fromADInputValue(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface BSCalendarInputProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  min?: Date | null;
  max?: Date | null;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function BSCalendarInput({
  value,
  onChange,
  min,
  max,
  label,
  placeholder = "Select date",
  className = "",
  disabled,
}: BSCalendarInputProps) {
  const defaultMode = useCalendarPreference();
  const [mode, setMode] = useState<"bs" | "ad">(defaultMode);
  const [prevDefault, setPrevDefault] = useState(defaultMode);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const adInputId = useId();
  const modalRef = useModalAccessibility<HTMLDivElement>(() => setOpen(false), open);

  // Sync mode when default changes (adjust state during render)
  if (prevDefault !== defaultMode) {
    setPrevDefault(defaultMode);
    setMode(defaultMode);
  }

  const displayBS = value ? toBS(value) : "";
  const displayAD = value
    ? value.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const displaySecondary = value
    ? mode === "bs" ? toBSEnglish(value) : toBS(value)
    : "";

  const toggleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMode((m) => (m === "bs" ? "ad" : "bs"));
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={triggerId} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      )}

      {/* Clickable input area */}
      <div className="relative flex items-center">
        <button
          id={triggerId}
          type="button"
          aria-label={label || placeholder}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className={`w-full border rounded-xl px-4 py-3 ${value && !disabled ? "pr-10" : ""} text-sm text-left transition-all flex items-center gap-3 ${open ? "border-primary ring-2 ring-primary/10 bg-primary/[0.03]" : "border-border bg-white hover:border-primary/50"
            } ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "cursor-pointer"} focus:outline-none`}
        >
          <span
            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${value ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
              }`}
          >
            <CalendarDays size={17} />
          </span>
          <div className="flex-1 min-w-0">
            {value ? (
              <>
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {mode === "bs" ? displayBS : displayAD}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{displaySecondary}</p>
              </>
            ) : (
              <span className="text-sm text-slate-400">{placeholder}</span>
            )}
          </div>
        </button>

        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="absolute right-3 p-1 rounded-md hover:bg-slate-100 text-slate-400 transition-colors"
            aria-label={`Clear ${label || "date"}`}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Calendar modal - screen ko bicha ma (dept add jastai overlay) */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-label={label || "Select date"}
              tabIndex={-1}
              className="bg-white rounded-2xl shadow-xl w-full max-w-[340px] overflow-hidden outline-none"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <span className="text-sm font-bold text-slate-800">
                  {mode === "bs" ? "Bikram Sambat" : "English Calendar"}
                </span>
                <button
                  type="button"
                  onClick={toggleMode}
                  aria-label={`Switch to ${mode === "bs" ? "English (AD)" : "Nepali (BS)"} calendar`}
                  className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg px-2.5 py-1 transition-colors"
                >
                  <ArrowRightLeft size={12} />
                  {mode === "bs" ? "AD" : "BS"}
                </button>
              </div>

              <div className="px-4 py-2.5 bg-primary/5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-primary truncate">
                  {value ? (mode === "bs" ? displayBS : displayAD) : "Pick a date"}
                </span>
                {value && (
                  <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="text-[11px] font-medium text-slate-500 hover:text-red-500 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {mode === "bs" ? (
                <BSCalendar
                  value={value}
                  onChange={(date) => {
                    onChange(date);
                    setOpen(false);
                  }}
                  min={min}
                  max={max}
                />
              ) : (
                <div className="p-4">
                  <label htmlFor={adInputId} className="block text-xs font-semibold text-slate-500 mb-1">Select date</label>
                  <input
                    id={adInputId}
                    type="date"
                    value={value ? toADInputValue(value) : ""}
                    onChange={(e) => {
                      const d = fromADInputValue(e.target.value);
                      onChange(d);
                      setOpen(false);
                    }}
                    min={min ? toADInputValue(min) : undefined}
                    max={max ? toADInputValue(max) : undefined}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
                    autoFocus
                  />
                </div>
              )}

              <div className="p-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium transition-all hover:bg-primary-hover"
                >
                  {value ? "Done" : "Cancel"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
