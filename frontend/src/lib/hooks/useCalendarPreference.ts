import { useAppSelector } from "./redux";

const LOCAL_KEY = "calendar-preference";

/** Calendar preference hook - user ko profile (auth user) bata aaudacha, company setting hoina */
export function useCalendarPreference(): "bs" | "ad" {
  const authPref = useAppSelector((s) => s.auth.user?.calendarPreference);

  // localStorage user-specific override (calendar page toggle + profile save bata set huncha)
  if (typeof window !== "undefined") {
    const local = localStorage.getItem(LOCAL_KEY);
    if (local === "bs" || local === "ad") return local;
  }

  return authPref || "bs";
}

/** Persist a per-user calendar override to localStorage. */
export function setCalendarPreference(pref: "bs" | "ad") {
  localStorage.setItem(LOCAL_KEY, pref);
}

/** Clear per-user override, falling back to the profile default. */
export function clearCalendarPreference() {
  localStorage.removeItem(LOCAL_KEY);
}