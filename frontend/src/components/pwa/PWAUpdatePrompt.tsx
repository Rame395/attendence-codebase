import { useEffect } from "react";
import { toast } from "sonner";

/** PWA update notifier */
export default function PWAUpdatePrompt() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let interval: ReturnType<typeof setInterval> | undefined;

    const onControllerChange = () => {
      toast.info("New version available", {
        description: "Refresh to get the latest attendance features.",
        duration: 10000,
        action: {
          label: "Reload",
          onClick: () => window.location.reload(),
        },
      });
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Periodic check for SW updates (every 60 min). Works with vite-plugin-pwa autoUpdate.
    const scheduleUpdateCheck = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        // initial offline-ready hint
        if (reg.active) {
          // registerSW shows offline-ready via custom event
          if (navigator.serviceWorker.controller) {
            // already controlled — don't spam, only show when coming online/offline
          }
        }
        interval = setInterval(() => {
          reg.update().catch(() => {
            // ignore network errors
          });
        }, 60 * 60 * 1000);
      } catch {
        // ignore — SW not ready yet
      }
    };
    scheduleUpdateCheck();

    const onOnline = () => toast.success("Back online — attendance sync active", { duration: 2000 });
    const onOffline = () => toast.warning("You're offline — check-in needs internet", { duration: 3000 });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (interval) clearInterval(interval);
    };
  }, []);

  return null;
}
