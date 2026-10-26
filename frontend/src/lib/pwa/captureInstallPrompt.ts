// beforeinstallprompt React mount bhanda aghi capture garne
declare global {
  interface Window {
    __deferredPrompt?: import("../hooks/usePWAInstall").BeforeInstallPromptEvent;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== "undefined" && !(window as any).__pwaPromptCaptured) {
  // flag to avoid double attachment after HMR
  (window as unknown as Record<string, unknown>).__pwaPromptCaptured = true;

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    // store globally so hook can pick it up even if mounted after the event
    window.__deferredPrompt = e as unknown as import("../hooks/usePWAInstall").BeforeInstallPromptEvent;
    // also dispatch a custom event so hook can react immediately
    window.dispatchEvent(new CustomEvent("pwa:deferredReady", { detail: e }));
  });

  window.addEventListener("appinstalled", () => {
    window.__deferredPrompt = undefined;
  });
}
