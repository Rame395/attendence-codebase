import { useEffect } from "react";
import axiosInstance from "../../config/ApiClient";

// brand theme - superadmin Settings bata, login pachi apply huncha

export const DEFAULT_BRAND_COLOR = "#28469E";
const STORAGE_KEY = "brand_color";
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidBrandColor(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v.trim());
}

// hex lai percent le darken garne (0-100)
function darken(hex: string, percent: number): string {
  const n = hex.replace("#", "");
  const f = Math.min(Math.max(percent, 0), 100) / 100;
  const ch = (i: number) => {
    const v = parseInt(n.slice(i, i + 2), 16);
    return Math.round(v * (1 - f))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`.toUpperCase();
}

// runtime theme vars set garne - Tailwind utilities resolve huncha
export function applyBrandColor(hex: string): void {
  if (!isValidBrandColor(hex) || typeof document === "undefined") return;
  const c = hex.trim().toUpperCase();
  const root = document.documentElement;
  const hover = darken(c, 25);
  const active = darken(c, 45);
  root.style.setProperty("--color-primary", c);
  root.style.setProperty("--primary", c);
  root.style.setProperty("--color-primary-hover", hover);
  root.style.setProperty("--primary-hover", hover);
  root.style.setProperty("--color-primary-active", active);
  root.style.setProperty("--color-ring", c);
  root.style.setProperty("--ring", c);
  root.style.setProperty("--color-secondary-foreground", c);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c);
  try {
    localStorage.setItem(STORAGE_KEY, c);
  } catch {
    // private mode - ignore
  }
}

// default blue ma farkaune (logout / platform-admin / color nabhaye)
export function resetBrandColor(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const k of [
    "--color-primary",
    "--primary",
    "--color-primary-hover",
    "--primary-hover",
    "--color-primary-active",
    "--color-ring",
    "--ring",
    "--color-secondary-foreground",
  ]) {
    root.style.removeProperty(k);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", DEFAULT_BRAND_COLOR);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// layout mount ma: cached color turuntai (flash rokna) + server fresh confirm
export function useBrandTheme(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (isValidBrandColor(cached)) applyBrandColor(cached);
    } catch {
      // ignore
    }
    (async () => {
      try {
        const res = (await axiosInstance.get("/company-settings")) as unknown as {
          data?: { brandColor?: string } | null;
        };
        if (!active) return;
        const color = res?.data?.brandColor;
        if (isValidBrandColor(color)) {
          applyBrandColor(color);
        } else {
          // server ma color chaina (purano doc) - arko company ko stale cache hataune
          resetBrandColor();
        }
      } catch {
        // offline/server fail - cached/default nai rahanchha
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled]);
}
