import { Download, Share, X, Smartphone, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { usePWAInstall } from "../../lib/hooks/usePWAInstall";
import { useAppSelector } from "../../lib/hooks/redux";

type Variant = "banner" | "card" | "sidebar";

/** PWA install UI for employees */
export default function PWAInstallBanner({ variant = "banner" }: { variant?: Variant }) {
  const authUser = useAppSelector((s) => s.auth.authUser);
  const { canPrompt, iosHint, showFallback, isInstalled, promptInstall, dismiss } = usePWAInstall();

  // only for employees (per requirement: employee uses mobile PWA, HR uses desktop)
  if (authUser?.role !== "employee") return null;
  if (isInstalled) return null;
  if (!canPrompt && !iosHint && !showFallback) return null;

  const handleInstall = async () => {
    const ok = await promptInstall();
    if (!ok) {
      // No deferred prompt yet — guide via browser menu
      toast.info("Install via browser menu", {
        description: "Open the browser menu (⋮) → Install app / Add to Home Screen. On iPhone use Share → Add to Home Screen.",
        duration: 6000,
      });
    }
  };

  if (variant === "sidebar") {
    // compact row for AdminSidebar — still respects same gating
    if (iosHint) {
      return (
        <div className="mx-2 rounded-xl border border-border bg-secondary-muted/40 p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
              <Share size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800">Get the App</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                Tap <span className="font-semibold">Share</span> → <span className="font-semibold">Add to Home Screen</span> to install.
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismiss}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      );
    }
     // fallback + canPrompt share the same compact card — button guides via menu if prompt not ready
     return (
      <div className="mx-2 rounded-xl border border-primary/10 bg-gradient-to-br from-primary to-primary-active p-3 text-white shadow-md">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <Smartphone size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wide">Get the App</p>
            <p className="mt-0.5 text-[11px] leading-snug text-white/70">
              {canPrompt ? "Install for faster check-in & offline access." : "Tap Install or browser menu "}
              {!canPrompt && (
                <span className="inline-flex items-center gap-0.5 font-semibold text-white">
                  <MoreVertical size={10} /> Install app
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={handleInstall}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary hover:bg-secondary-hover transition-colors"
            >
              <Download size={13} /> {canPrompt ? "Install" : "Install / How?"}
            </button>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  // banner / card — used on EmployeeDashboard
  if (iosHint) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/5" />
        <div className="relative flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Share size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Get the App on your iPhone</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Install this app for one-tap check-in. Tap the <span className="inline-flex items-center gap-1 font-semibold text-slate-800"><Share size={12} /> Share</span> button in Safari, then
              <span className="font-semibold text-slate-800"> Add to Home Screen</span>.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // card + banner share fallback logic — canPrompt or showFallback both visible
  if (variant === "card") {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-hover to-primary-active p-[1px] shadow-lg">
        <div className="rounded-[15px] bg-gradient-to-br from-primary via-primary-hover to-primary-active p-4 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur border border-white/10">
              <Smartphone size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Get the App</p>
              <p className="mt-1 text-xs leading-relaxed text-white/70">
                {canPrompt
                  ? "Install for instant GPS check-in — works like a native app. No App Store needed."
                  : "Install for instant check-in — tap Install or browser menu (⋮) → Install app. On iPhone use Share → Add to Home Screen."}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInstall}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2 text-sm font-bold text-primary hover:bg-secondary-hover active:scale-[0.98] transition-all"
                >
                  <Download size={16} /> {canPrompt ? "Install App" : "Install / Guide"}
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-xl px-3 py-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismiss}
              className="shrink-0 rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // default banner (compact row, fits above hero card) — now also used for fallback
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-white p-3 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Smartphone size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-none text-slate-900">Get the App</p>
        <p className="text-[11px] text-slate-500">
          {canPrompt ? "Install for faster, offline-ready check-in" : "Tap Install or browser menu "}
          {!canPrompt && (
            <span className="inline-flex items-center gap-0.5 font-semibold text-slate-700">
              <MoreVertical size={10} /> Install app
            </span>
          )}
          {showFallback && !canPrompt && <span className="text-slate-400"> — also iPhone: Share → Add to Home Screen</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-primary/90 active:scale-[0.98] transition-all"
      >
        <Download size={14} /> {canPrompt ? "Install" : "Guide"}
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      >
        <X size={16} />
      </button>
    </div>
  );
}
