import NepaliDate from "nepali-date-converter";

// BS (Bikram Sambat) date helpers

const NEPALI_MONTHS = [
  "Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

const NEPALI_MONTHS_NP = [
  "\u092C\u0948\u0936\u093E\u0916", "\u091C\u0947\u0920", "\u0905\u0938\u093E\u0930", "\u0936\u094D\u0930\u093E\u0935\u0923", "\u092D\u093E\u0926\u094D\u0930", "\u0906\u0936\u094D\u0935\u093F\u0928",
  "\u0915\u093E\u0930\u094D\u0924\u093F\u0915", "\u092E\u0902\u0938\u093F\u0930", "\u092A\u094C\u0937", "\u092E\u093E\u0918", "\u092B\u093E\u0932\u094D\u0917\u0941\u0928", "\u091A\u0948\u0924\u094D\u0930",
];

const NEPALI_DIGITS = ["\u0966", "\u0967", "\u0968", "\u0969", "\u096A", "\u096B", "\u096C", "\u096D", "\u096E", "\u096F"];

const WEEKDAYS_NP = ["\u0906\u0907\u0924", "\u0938\u094B\u092E", "\u092E\u0919\u094D\u0917\u0932", "\u092C\u0941\u0927", "\u092C\u093F\u0939\u093F\u0936\u092E\u094D\u0915\u0930", "\u0936\u0941\u0915\u094D\u0930", "\u0936\u0928\u093F"];

// AD -> BS - Devanagari format
export function toBS(date: Date): string {
  try {
    const bs = new NepaliDate(date);
    const d = bs.getBS();
    return `${toNepaliDigits(d.date)} ${NEPALI_MONTHS_NP[d.month]} ${toNepaliDigits(d.year)}`;
  } catch {
    return "-";
  }
}

// BS -> AD Date object (reverse conversion)
export function bsToDate(bsYear: number, bsMonth: number, bsDate: number): Date {
  return new NepaliDate(bsYear, bsMonth, bsDate).toJsDate();
}

// BS input value "YYYY-MM-DD" -> JS Date
export function fromBSInputValue(bsStr: string): Date | null {
  if (!bsStr) return null;
  const [y, m, d] = bsStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  try {
    return bsToDate(y, m - 1, d);
  } catch {
    return null;
  }
}

// JS Date -> BS input value "YYYY-MM-DD"
export function toBSInputValue(date: Date): string {
  try {
    const bs = new NepaliDate(date);
    const d = bs.getBS();
    return `${d.year}-${String(d.month + 1).padStart(2, "0")}-${String(d.date).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

// Local date -> "YYYY-MM-DD" (toISOString ko UTC -1 day shift bina)
export function toLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// date ma n days add/subtract garne (month rollover safe, time 00:00 ma)
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// BS month ko days count
export function getBSDaysInMonth(bsYear: number, bsMonth: number): number {
  try {
    const nextMonth = bsMonth === 11 ? 0 : bsMonth + 1;
    const nextYear = bsMonth === 11 ? bsYear + 1 : bsYear;
    const end = new NepaliDate(nextYear, nextMonth, 1).toJsDate();
    const start = new NepaliDate(bsYear, bsMonth, 1).toJsDate();
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 30;
  }
}

// Short - "२६ श्रावण"
export function toBSShort(date: Date): string {
  try {
    const bs = new NepaliDate(date);
    const d = bs.getBS();
    return `${toNepaliDigits(d.date)} ${NEPALI_MONTHS_NP[d.month]}`;
  } catch {
    return "-";
  }
}

// Dual - "२६ श्रावण २०८३ · 10 Aug 2026"
export function toBSDual(date: Date): string {
  const ad = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return `${toBS(date)} \u00B7 ${ad}`;
}

// English BS - "26 Shrawan 2083"
export function toBSEnglish(date: Date): string {
  try {
    const bs = new NepaliDate(date);
    const d = bs.getBS();
    return `${d.date} ${NEPALI_MONTHS[d.month]} ${d.year}`;
  } catch {
    return "-";
  }
}

// Short English BS - "26 Shrawan"
export function toBSShortEnglish(date: Date): string {
  try {
    const bs = new NepaliDate(date);
    const d = bs.getBS();
    return `${d.date} ${NEPALI_MONTHS[d.month]}`;
  } catch {
    return "-";
  }
}

export function getBSMonthName(date: Date): string {
  try {
    const bs = new NepaliDate(date);
    return NEPALI_MONTHS_NP[bs.getBS().month];
  } catch {
    return "-";
  }
}

export function getBSMonthNameEnglish(date: Date): string {
  try {
    const bs = new NepaliDate(date);
    return NEPALI_MONTHS[bs.getBS().month];
  } catch {
    return "-";
  }
}

export function getBSYear(date: Date): number {
  const bs = new NepaliDate(date);
  return bs.getBS().year;
}

export function getBSMonthIndex(date: Date): number {
  const bs = new NepaliDate(date);
  return bs.getBS().month;
}

export function getBSDateParts(date: Date): { year: number; month: number; date: number; day: number } {
  const bs = new NepaliDate(date);
  const d = bs.getBS();
  return { year: d.year, month: d.month, date: d.date, day: d.day ?? 0 };
}

export function getBSWeekday(date: Date): string {
  try {
    const bs = new NepaliDate(date);
    return WEEKDAYS_NP[bs.getDay()];
  } catch {
    return "-";
  }
}

export function toNepaliDigits(num: number | string): string {
  return String(num).split("").map((ch) => /\d/.test(ch) ? NEPALI_DIGITS[Number(ch)] : ch).join("");
}

// Nepali digits (०-९) -> ASCII digits, so users can type BS dates in either script
export function nepaliDigitsToAscii(input: string): string {
  return String(input ?? "").replace(/[०-९]/g, (ch) => String(NEPALI_DIGITS.indexOf(ch)));
}

export function formatWorkingMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function formatTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const AD_FORMATTED: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/** Primary date display — BS in Devanagari or English AD depending on mode. */
export function formatDate(date: Date, mode: "bs" | "ad"): string {
  return mode === "bs" ? toBS(date) : date.toLocaleDateString("en-GB", AD_FORMATTED);
}

/** Dual display — BS·AD when mode=bs, AD·BS when mode=ad (secondary always shown). */
export function formatDateDual(date: Date, mode: "bs" | "ad"): string {
  if (mode === "bs") return toBSDual(date);
  const ad = date.toLocaleDateString("en-GB", AD_FORMATTED);
  return `${ad} · ${toBS(date)}`;
}

/** Short dual — for compact spaces like badges / table cells. */
export function formatDateShort(date: Date, mode: "bs" | "ad"): string {
  if (mode === "bs") return toBSShort(date);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Time only — "2:30 PM" (time is same in BS/AD, calendar only changes the date part). */
export function formatTimeFromDate(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Date + time — "10 Aug 2026, 2:30 PM" or "२६ श्रावण २०८३, 2:30 PM" depending on mode. */
export function formatDateTime(date: Date, mode: "bs" | "ad"): string {
  return `${formatDate(date, mode)}, ${formatTimeFromDate(date)}`;
}

/** Relative — "Just now", "5m ago", "2h ago", "3d ago", "2w ago", "3mo ago", "1y ago". */
export function formatRelativeTime(input: string | Date): string {
  const t = input instanceof Date ? input.getTime() : new Date(input).getTime();
  if (Number.isNaN(t)) return "-";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return "Just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
