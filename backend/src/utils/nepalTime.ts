// Nepal Time (UTC+5:45) helpers - server/container timezone bhanda Nepal calendar day follow garne
export const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000; // +05:45

const pad = (n: number) => String(n).padStart(2, "0");

/** Nepal-calendar date key "YYYY-MM-DD" for a given instant. */
export function nptTodayKey(date: Date = new Date()): string {
  const n = new Date(date.getTime() + NPT_OFFSET_MS);
  return `${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}-${pad(n.getUTCDate())}`;
}

/** UTC instants spanning the Nepal day containing `date`. */
export function nptDayWindow(date: Date = new Date()): {
  dayStart: Date;
  dayEnd: Date;
} {
  const [y, m, d] = nptTodayKey(date).split("-").map(Number);
  const dayStart = new Date(Date.UTC(y, m - 1, d) - NPT_OFFSET_MS);
  return {
    dayStart,
    dayEnd: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1),
  };
}

/** Nepal-clock hour (0-23) for a given instant. */
export function nptHour(date: Date = new Date()): number {
  return new Date(date.getTime() + NPT_OFFSET_MS).getUTCHours();
}

export const NPT_WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Nepal weekday name for a given instant. */
export function nptWeekday(date: Date = new Date()): string {
  return NPT_WEEKDAYS[new Date(date.getTime() + NPT_OFFSET_MS).getUTCDay()];
}
