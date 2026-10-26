import { useCallback, useState } from "react";

interface IGpsState {
  loading: boolean;
  error: string | null;
}

// browser geolocation API bata GPS linne hook - always fresh, no cache
export function useGps() {
  const [state, setState] = useState<IGpsState>({ loading: false, error: null });

  const getLocation = useCallback((): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      const isSecure = window.isSecureContext;
      if (!navigator.geolocation) {
        const err = "Geolocation is not supported by this browser";
        setState({ loading: false, error: err });
        reject(new Error(err));
        return;
      }
      if (!isSecure) {
        const err = "Location is blocked because this page is not served securely. Open the app at http://localhost:5173 (or use HTTPS) to use location.";
        setState({ loading: false, error: err });
        reject(new Error(err));
        return;
      }

      setState({ loading: true, error: null });

      // Try to revoke any cached permission so browser re-prompts
      if ("permissions" in navigator) {
        navigator.permissions.query({ name: "geolocation" }).then((result) => {
          if (result.state === "granted" && "revoke" in result && typeof (result as any).revoke === "function") {
            (result as any).revoke().catch(() => {});
          }
        }).catch(() => {});
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setState({ loading: false, error: null });
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          let message = "Failed to get your location";
          if (err.code === err.PERMISSION_DENIED) {
            message =
              "Location permission denied. Go to browser Settings → Site Settings → Location and allow this site, then reload.";
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            message = "Location unavailable. Make sure GPS/Wi-Fi is enabled and try again.";
          } else if (err.code === err.TIMEOUT) {
            message = "Location request timed out. Go outdoors or near a window and retry.";
          }

          setState({ loading: false, error: message });
          reject(new Error(message));
        },
        // maximumAge: 0 → always get fresh coordinates, never cached
        // timeout: 20s → give enough time for GPS lock
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    });
  }, []);

  return { ...state, getLocation };
}
