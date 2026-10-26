import { useCallback, useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    // iOS Safari proprietary
    if ((window.navigator as unknown as { standalone?: boolean }).standalone) return true;
    if (document.referrer.includes("android-app://")) return true;
  } catch {
    // ignore
  }
  return false;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isDismissedRecently(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const t = Number(v);
    if (Number.isNaN(t)) return false;
    return Date.now() - t < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/** PWA install prompt hook */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    // pick up prompt captured before React mounted (captureInstallPrompt.ts)
    if (typeof window !== "undefined" && window.__deferredPrompt) {
      return window.__deferredPrompt;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandalone());
  const [dismissed, setDismissed] = useState<boolean>(() => isDismissedRecently());

  useEffect(() => {
    // debug helper: ?pwa-reset clears dismiss for testing
    try {
      if (typeof window !== "undefined" && window.location.search.includes("pwa-reset")) {
        localStorage.removeItem(DISMISS_KEY);
        setDismissed(false);
      }
    } catch {
      // ignore
    }
    // if prompt was captured before hook mounted but not yet in state, sync it
    if (typeof window !== "undefined" && window.__deferredPrompt && !deferredPrompt) {
      setDeferredPrompt(window.__deferredPrompt);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      const be = e as BeforeInstallPromptEvent;
      window.__deferredPrompt = be;
      setDeferredPrompt(be);
    };

    const onDeferredReady = (e: Event) => {
      const ce = e as CustomEvent<BeforeInstallPromptEvent>;
      if (ce.detail) setDeferredPrompt(ce.detail);
      else if (window.__deferredPrompt) setDeferredPrompt(window.__deferredPrompt);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__deferredPrompt = undefined;
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        // ignore
      }
    };

    const mql = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = (ev: MediaQueryListEvent) => {
      if (ev.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
        window.__deferredPrompt = undefined;
      }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsInstalled(isStandalone());

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("pwa:deferredReady" as unknown as keyof WindowEventMap, onDeferredReady as EventListener);
    // Safari < 14 fallback — watch media query
    if (mql.addEventListener) mql.addEventListener("change", onDisplayModeChange);
    else (mql as unknown as { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener(onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("pwa:deferredReady" as unknown as keyof WindowEventMap, onDeferredReady as EventListener);
      if (mql.removeEventListener) mql.removeEventListener("change", onDisplayModeChange);
      else (mql as unknown as { removeListener: (cb: (e: MediaQueryListEvent) => void) => void }).removeListener(onDisplayModeChange);
    };
  }, []);

  const canPrompt = !!deferredPrompt && !isInstalled && !dismissed;
  const iosHint = !isInstalled && !canPrompt && isIOS() && !dismissed;
  // fallback — employee sees banner even before the browser decides installability
  const showFallback = !isInstalled && !dismissed && !canPrompt && !iosHint;

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "dismissed") {
        try {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
          // ignore
        }
        setDismissed(true);
        return false;
      }
      // accepted → appinstalled event will flip isInstalled
      return true;
    } catch {
      return false;
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setDismissed(true);
    // deferredPrompt re-trigger rakhe, banner cooldown samma lukda
  }, []);

  const resetDismiss = useCallback(() => {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      // ignore
    }
    setDismissed(false);
  }, []);

  return {
    deferredPrompt,
    isInstalled,
    canPrompt,
    iosHint,
    showFallback,
    isIOS: isIOS(),
    dismissed,
    promptInstall,
    dismiss,
    resetDismiss,
  };
}
