// Default company timezone (container UTC bhaye pani)
export const COMPANY_TIMEZONE = "Asia/Kathmandu";

// IANA timezone ko UTC offset (minutes) - Node bundled ICU use garxa
export function timeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const hour = parts.hour === 24 ? 0 : parts.hour;
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, hour, parts.minute, parts.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Wall-clock (year, month 0-11, day, minutesOfDay) of an instant in a timezone
export function wallClockParts(instant: Date, offsetMinutes: number) {
  const shifted = new Date(instant.getTime() + offsetMinutes * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

// Real UTC instant for a wall-clock date + minutesOfDay in a timezone
export function tzInstant(offsetMinutes: number, year: number, month: number, day: number, minutesOfDay: number): Date {
  return new Date(Date.UTC(year, month, day, 0, minutesOfDay) - offsetMinutes * 60000);
}