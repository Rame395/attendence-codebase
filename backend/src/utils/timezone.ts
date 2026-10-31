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

// Parse "YYYY-MM-DD" or Date into Asia/Kathmandu calendar day boundaries [00:00:00.000, 23:59:59.999]
export function tzDayRange(input: string | Date, timeZone = COMPANY_TIMEZONE): {
  year: number;
  month: number;
  day: number;
  offset: number;
  start: Date;
  end: Date;
  dateKey: string;
} {
  if (typeof input === "string") {
    const trimmed = input.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const probe = new Date(Date.UTC(year, month, day, 12, 0, 0));
      const offset = timeZoneOffsetMinutes(timeZone, probe);
      const start = tzInstant(offset, year, month, day, 0);
      const end = new Date(tzInstant(offset, year, month, day, 1440).getTime() - 1);
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { year, month, day, offset, start, end, dateKey };
    }
  }

  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw { code: 422, message: "Invalid date provided" };
  }
  const offset = timeZoneOffsetMinutes(timeZone, d);
  const wall = wallClockParts(d, offset);
  const start = tzInstant(offset, wall.year, wall.month, wall.day, 0);
  const end = new Date(tzInstant(offset, wall.year, wall.month, wall.day, 1440).getTime() - 1);
  const dateKey = `${wall.year}-${String(wall.month + 1).padStart(2, "0")}-${String(wall.day).padStart(2, "0")}`;
  return { year: wall.year, month: wall.month, day: wall.day, offset, start, end, dateKey };
}

// Combine a base date ("YYYY-MM-DD" or Date) with a time input ("HH:mm", "HH:mm:ss", or ISO string) in company timezone
export function parseTimeOnDate(baseDate: string | Date, timeInput: unknown, timeZone = COMPANY_TIMEZONE): Date | null {
  if (timeInput === undefined || timeInput === null || timeInput === "") {
    return null;
  }
  if (timeInput instanceof Date) {
    if (Number.isNaN(timeInput.getTime())) {
      throw { code: 422, message: "Invalid time value" };
    }
    return timeInput;
  }
  const str = String(timeInput).trim();
  if (!str) return null;

  // Match "HH:mm" or "HH:mm:ss"
  const hhmm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(str);
  if (hhmm) {
    const hours = Number(hhmm[1]);
    const minutes = Number(hhmm[2]);
    const seconds = hhmm[3] ? Number(hhmm[3]) : 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
      throw { code: 422, message: "Invalid time value" };
    }
    const { year, month, day, offset } = tzDayRange(baseDate, timeZone);
    const baseInstant = tzInstant(offset, year, month, day, hours * 60 + minutes);
    return seconds ? new Date(baseInstant.getTime() + seconds * 1000) : baseInstant;
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    throw { code: 422, message: `Invalid time format: "${str}"` };
  }
  return parsed;
}

export function formatCompanyDate(input: Date | string, timeZone = COMPANY_TIMEZONE): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatCompanyTime(input: Date | string, timeZone = COMPANY_TIMEZONE): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
}
