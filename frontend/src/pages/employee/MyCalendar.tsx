import { useEffect, useMemo, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Sun, Plane, Calendar } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import { getErrorMessage } from "../../lib/getErrorMessage";
import {
  bsToDate,
  getBSDaysInMonth,
  getBSDateParts,
  toBS,
  toNepaliDigits,
  toLocalDateInput,
  parseLocalDate,
  formatDateShort,
  formatDateDual,
  formatTime,
  formatWorkingMinutes,
} from "../../lib/nepali-date";
import { useCalendarPreference, setCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import { useModalAccessibility } from "../../lib/hooks/useModalAccessibility";
import { useAppSelector } from "../../lib/hooks/redux";
import { fetchHolidayViewer, isHolidayApplicable, type IHolidayLike, type IHolidayViewer } from "../../lib/holidayScope";

interface IDayData {
  date: string;
  status: string;
  checkIn: { time: string; distance: number } | null;
  checkOut: { time: string; distance: number } | null;
  workingMinutes: number;
  holidayTitle: string | null;
}

type IHoliday = IHolidayLike;

interface ICalEvent {
  _id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  type?: string;
}

// Status colors - bold solid bg for legend, lighter for cells
const STATUS_STYLES: Record<string, { cell: string; solid: string; text: string; border: string; label: string }> = {
  present: { cell: "bg-emerald-50 border-emerald-300", solid: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-300", label: "Present" },
  late: { cell: "bg-amber-50 border-amber-300", solid: "bg-amber-500", text: "text-amber-700", border: "border-amber-300", label: "Late" },
  absent: { cell: "bg-rose-50 border-rose-300", solid: "bg-rose-500", text: "text-rose-700", border: "border-rose-300", label: "Absent" },
  half_day: { cell: "bg-orange-50 border-orange-300", solid: "bg-orange-500", text: "text-orange-700", border: "border-orange-300", label: "Half Day" },
  leave: { cell: "bg-blue-50 border-blue-300", solid: "bg-blue-500", text: "text-blue-700", border: "border-blue-300", label: "Leave" },
  holiday: { cell: "bg-red-50 border-red-300", solid: "bg-red-500", text: "text-red-700", border: "border-red-300", label: "Holiday" },
  weekend: { cell: "bg-red-50 border-red-300", solid: "bg-red-500", text: "text-red-600", border: "border-red-300", label: "Weekend" },
  none: { cell: "bg-white border-slate-200", solid: "bg-slate-200", text: "text-slate-400", border: "border-slate-200", label: "-" },
};

// Event type colors
const EVENT_TYPE_STYLE: Record<string, { cell: string; solid: string; text: string; border: string; label: string }> = {
  company_event: { cell: "bg-violet-50 border-violet-300", solid: "bg-violet-500", text: "text-violet-600", border: "border-violet-300", label: "Event" },
  staff_training: { cell: "bg-blue-50 border-blue-300", solid: "bg-blue-500", text: "text-blue-600", border: "border-blue-300", label: "Training" },
  meeting: { cell: "bg-amber-50 border-amber-300", solid: "bg-amber-500", text: "text-amber-600", border: "border-amber-300", label: "Meeting" },
  other: { cell: "bg-slate-50 border-slate-300", solid: "bg-slate-400", text: "text-slate-500", border: "border-slate-300", label: "Event" },
};

function LegendList({ styles }: { styles: Record<string, { solid: string; label: string }> }) {
  // Group entries by solid color, merge labels with " / "
  const groups = useMemo(() => {
    const map = new Map<string, { solid: string; labels: string[] }>();
    for (const [, v] of Object.entries(styles)) {
      if (v.solid === "bg-slate-200") continue; // skip "none"
      const existing = map.get(v.solid);
      if (existing) {
        if (!existing.labels.includes(v.label)) existing.labels.push(v.label);
      } else {
        map.set(v.solid, { solid: v.solid, labels: [v.label] });
      }
    }
    return Array.from(map.values());
  }, [styles]);

  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((g) => (
        <div key={g.solid} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-100 bg-slate-50">
          <span className={`w-3 h-3 rounded ${g.solid} shrink-0`} />
          <span className="text-xs font-semibold text-slate-700">{g.labels.join(" / ")}</span>
        </div>
      ))}
    </div>
  );
}

const WEEKDAYS_BS = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];
const WEEKDAYS_AD_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEKDAYS_AD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_NAME = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const NEPALI_MONTHS_NP = [
  "बैशाख", "जेठ", "असार", "श्रावण", "भाद्र", "आश्विन",
  "कार्तिक", "मंसिर", "पौष", "माघ", "फाल्गुन", "चैत्र",
];

const NEPALI_MONTHS_EN = [
  "Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

const AD_MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function bsMonthToADRange(bsYear: number, bsMonth: number): { startAD: Date; endAD: Date } {
  const startAD = bsToDate(bsYear, bsMonth, 1);
  const daysInBS = getBSDaysInMonth(bsYear, bsMonth);
  const endAD = bsToDate(bsYear, bsMonth, daysInBS);
  return { startAD, endAD };
}

function getTodayBS(): { year: number; month: number; date: number } {
  return getBSDateParts(new Date());
}

function selectCompact() {
  return "h-8 px-2 pr-5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white outline-none appearance-none cursor-pointer hover:border-slate-300 transition-colors";
}

export default function MyCalendar() {
  const basePref = useCalendarPreference();
  const [prefOverride, setPrefOverride] = useState<"bs" | "ad" | null>(null);
  const calPref = prefOverride ?? basePref;

  const todayBS = useMemo(() => getTodayBS(), []);
  const todayKey = toLocalDateInput(new Date());

  const { authUser } = useAppSelector((state) => state.auth);
  // super admin lai attendance info dekhaundaina - events/holidays matra
  const isSuperAdmin = authUser?.role === "super_admin";
  // company settings bata weekly holidays - super admin/no-profile fallback ma pani show garne
  const weeklyHolidays = useAppSelector((state) => state.companySetting.settings.weeklyHolidays);

  const companyCreatedAt = authUser?.company?.createdAt || null;
  const createdDate = useMemo(() => {
    if (!companyCreatedAt) return null;
    const d = new Date(companyCreatedAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [companyCreatedAt]);

  // Allow navigating up to 5 years into the past and 10 years into the future
  const minBs = useMemo(
    () => ({ year: todayBS.year - 5, month: 0 }),
    [todayBS.year],
  );
  const minAd = useMemo(
    () => ({ year: new Date().getFullYear() - 5, month: 0 }),
    [],
  );

  const maxFutureBsYear = todayBS.year + 10;
  const maxFutureAdYear = new Date().getFullYear() + 10;

  // Active anchor date preserves the exact date when switching between BS and AD
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [bsYear, setBsYear] = useState(todayBS.year);
  const [bsMonth, setBsMonth] = useState(todayBS.month);
  const [adYear, setAdYear] = useState(new Date().getFullYear());
  const [adMonth, setAdMonth] = useState(new Date().getMonth());

  const [days, setDays] = useState<IDayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IDayData | null>(null);
  const detailModalRef = useModalAccessibility<HTMLDivElement>(() => setSelected(null), !!selected);
  const [events, setEvents] = useState<ICalEvent[]>([]);
  const [holidays, setHolidays] = useState<IHoliday[]>([]);
  // viewer scope (gender/branch/department) - nalagne holiday lukauna
  const [viewer, setViewer] = useState<IHolidayViewer | null>(null);
  const [hasAttendance, setHasAttendance] = useState(!isSuperAdmin);

  const { startAD: fetchStartAD, endAD: fetchEndAD } = useMemo(() => {
    if (calPref === "bs") return bsMonthToADRange(bsYear, bsMonth);
    return { startAD: new Date(adYear, adMonth, 1), endAD: new Date(adYear, adMonth + 1, 0) };
  }, [calPref, bsYear, bsMonth, adYear, adMonth]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startKey = `${fetchStartAD.getFullYear()}-${String(fetchStartAD.getMonth() + 1).padStart(2, "0")}`;
      const endKey = `${fetchEndAD.getFullYear()}-${String(fetchEndAD.getMonth() + 1).padStart(2, "0")}`;
      const monthKeys = startKey === endKey ? [startKey] : [startKey, endKey];
      const startStr = toLocalDateInput(fetchStartAD);
      const endStr = toLocalDateInput(fetchEndAD);

      let allDays: IDayData[] = [];
      let profileMissing = false;

      if (!isSuperAdmin) {
        for (const mk of monthKeys) {
          const [y, m] = mk.split("-").map(Number);
          try {
            const res = await axiosInstance.get("/attendance/calendar", { params: { year: y, month: m } });
            allDays = allDays.concat(res.data?.days || []);
          } catch (err) {
            const msg = getErrorMessage(err, "").toLowerCase();
            if (msg.includes("employee profile") || msg.includes("not found")) {
              profileMissing = true;
            } else {
              throw err;
            }
          }
        }
      }

      if (profileMissing || isSuperAdmin) {
        setHasAttendance(false);
        const fallback: IDayData[] = [];
        for (let d = new Date(fetchStartAD); d <= fetchEndAD; d.setDate(d.getDate() + 1)) {
          const dd = new Date(d);
          fallback.push({
            date: toLocalDateInput(dd),
            status: weeklyHolidays.includes(WEEKDAYS_NAME[dd.getDay()]) ? "weekend" : "none",
            checkIn: null,
            checkOut: null,
            workingMinutes: 0,
            holidayTitle: null,
          });
        }
        setDays(fallback);
      } else {
        setHasAttendance(true);
        setDays(allDays.filter((d) => d.date >= startStr && d.date <= endStr));
      }

      const [eventRes, holidayRes, holidayViewer]: any[] = await Promise.all([
        axiosInstance.get("/events").catch(() => null),
        axiosInstance.get("/holidays").catch(() => null),
        fetchHolidayViewer(),
      ]);
      setViewer(holidayViewer as IHolidayViewer | null);

      setEvents(
        ((eventRes?.data || []) as ICalEvent[]).filter((e) => {
          if (!e.date) return false;
          const key = toLocalDateInput(new Date(e.date));
          return key >= startStr && key <= endStr;
        }),
      );
      setHolidays((holidayRes?.data || []) as IHoliday[]);
    } catch {
      toast.error("Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [fetchStartAD, fetchEndAD, isSuperAdmin, weeklyHolidays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // grid - active mode anusar BS or AD month
  const gridDays = useMemo(() => {
    if (calPref === "bs") {
      const total = getBSDaysInMonth(bsYear, bsMonth);
      const arr: { adDate: Date; adDateKey: string; primaryNum: number; oppositeNum: number; weekdayIdx: number }[] = [];
      for (let d = 1; d <= total; d++) {
        const adDate = bsToDate(bsYear, bsMonth, d);
        arr.push({ adDate, adDateKey: toLocalDateInput(adDate), primaryNum: d, oppositeNum: adDate.getDate(), weekdayIdx: getBSDateParts(adDate).day });
      }
      return arr;
    }
    const total = new Date(adYear, adMonth + 1, 0).getDate();
    const arr: { adDate: Date; adDateKey: string; primaryNum: number; oppositeNum: number; weekdayIdx: number }[] = [];
    for (let d = 1; d <= total; d++) {
      const adDate = new Date(adYear, adMonth, d);
      arr.push({ adDate, adDateKey: toLocalDateInput(adDate), primaryNum: d, oppositeNum: getBSDateParts(adDate).date, weekdayIdx: adDate.getDay() });
    }
    return arr;
  }, [calPref, bsYear, bsMonth, adYear, adMonth]);

  const firstDayOffset = useMemo(() => (gridDays.length > 0 ? gridDays[0].weekdayIdx : 0), [gridDays]);

  const daysByDate = useMemo(() => {
    const map = new Map<string, IDayData>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const holidaysOn = useCallback(
    (dateKey: string) => holidays.filter((h) => {
      if (!h.startDate || !h.endDate) return false;
      return toLocalDateInput(new Date(h.startDate)) <= dateKey && dateKey <= toLocalDateInput(new Date(h.endDate)) && isHolidayApplicable(h, viewer);
    }),
    [holidays, viewer],
  );

  const eventsOn = useCallback(
    (dateKey: string) => events.filter((e) => e.date && toLocalDateInput(new Date(e.date)) === dateKey),
    [events],
  );

  // Selector options: company created year -> +10 years (future selectable)
  const bsYearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = minBs.year; y <= maxFutureBsYear; y++) arr.push(y);
    return arr;
  }, [minBs.year, maxFutureBsYear]);

  const adYearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = minAd.year; y <= maxFutureAdYear; y++) arr.push(y);
    return arr;
  }, [minAd.year, maxFutureAdYear]);

  const bsMonthOptions = useMemo(() => {
    const minMonth = bsYear === minBs.year ? minBs.month : 0;
    const arr: number[] = [];
    for (let m = minMonth; m <= 11; m++) arr.push(m);
    return arr;
  }, [bsYear, minBs]);

  const adMonthOptions = useMemo(() => {
    const minMonth = adYear === minAd.year ? minAd.month : 0;
    const arr: number[] = [];
    for (let m = minMonth; m <= 11; m++) arr.push(m);
    return arr;
  }, [adYear, minAd]);

  const atMinBs = bsYear < minBs.year || (bsYear === minBs.year && bsMonth <= minBs.month);
  const atMinAd = adYear < minAd.year || (adYear === minAd.year && adMonth <= minAd.month);
  const atMaxBs = bsYear > maxFutureBsYear || (bsYear === maxFutureBsYear && bsMonth >= 11);
  const atMaxAd = adYear > maxFutureAdYear || (adYear === maxFutureAdYear && adMonth >= 11);

  const updateBsPeriod = (nextYear: number, nextMonth: number) => {
    setBsYear(nextYear);
    setBsMonth(nextMonth);
    const curBsDay = getBSDateParts(anchorDate).date;
    const maxDay = getBSDaysInMonth(nextYear, nextMonth);
    setAnchorDate(bsToDate(nextYear, nextMonth, Math.min(curBsDay, maxDay)));
  };

  const updateAdPeriod = (nextYear: number, nextMonth: number) => {
    setAdYear(nextYear);
    setAdMonth(nextMonth);
    const curAdDay = anchorDate.getDate();
    const maxDay = new Date(nextYear, nextMonth + 1, 0).getDate();
    setAnchorDate(new Date(nextYear, nextMonth, Math.min(curAdDay, maxDay)));
  };

  const prevMonth = () => {
    if (calPref === "bs") {
      if (atMinBs) return;
      if (bsMonth === 0) updateBsPeriod(bsYear - 1, 11);
      else updateBsPeriod(bsYear, bsMonth - 1);
    } else {
      if (atMinAd) return;
      if (adMonth === 0) updateAdPeriod(adYear - 1, 11);
      else updateAdPeriod(adYear, adMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calPref === "bs") {
      if (atMaxBs) return;
      if (bsMonth === 11) updateBsPeriod(bsYear + 1, 0);
      else updateBsPeriod(bsYear, bsMonth + 1);
    } else {
      if (atMaxAd) return;
      if (adMonth === 11) updateAdPeriod(adYear + 1, 0);
      else updateAdPeriod(adYear, adMonth + 1);
    }
  };

  // Nepali <-> English date converter: keep the exact active anchor date
  const togglePref = (next: "bs" | "ad") => {
    if (next === calPref) return;
    if (next === "ad") {
      setAdYear(Math.max(minAd.year, anchorDate.getFullYear()));
      setAdMonth(anchorDate.getMonth());
    } else {
      const parts = getBSDateParts(anchorDate);
      setBsYear(Math.max(minBs.year, parts.year));
      setBsMonth(parts.month);
    }
    setSelected(null);
    setPrefOverride(next);
    setCalendarPreference(next);
    void axiosInstance.patch("/auth/profile", { calendarPreference: next }).catch(() => null);
  };

  const isToday = (adDateKey: string) => adDateKey === todayKey;

  const selectedHolidays = selected ? holidaysOn(selected.date) : [];
  const selectedEvents = selected ? eventsOn(selected.date) : [];
  const selectedBeforeCompany = createdDate ? selected?.date && selected.date < toLocalDateInput(createdDate) : false;
  const createdDateKey = createdDate ? toLocalDateInput(createdDate) : null;

  const monthHolidays = useMemo(() => {
    const startStr = toLocalDateInput(fetchStartAD);
    const endStr = toLocalDateInput(fetchEndAD);
    return holidays.filter((h) => {
      if (!h.startDate || !h.endDate) return false;
      return toLocalDateInput(new Date(h.startDate)) <= endStr && toLocalDateInput(new Date(h.endDate)) >= startStr && isHolidayApplicable(h, viewer);
    });
  }, [holidays, viewer, fetchStartAD, fetchEndAD]);

  // active mode ko title + secondary (converter display)
  const viewTitle = useMemo(() => {
    if (calPref === "bs") {
      return {
        primary: `${NEPALI_MONTHS_NP[bsMonth]} ${toNepaliDigits(bsYear)}`,
        secondary: `${NEPALI_MONTHS_EN[bsMonth]} ${bsYear}`,
      };
    }
    const refDate =
      anchorDate.getFullYear() === adYear && anchorDate.getMonth() === adMonth
        ? anchorDate
        : new Date(adYear, adMonth, 1);
    const mp = getBSDateParts(refDate);
    return {
      primary: `${AD_MONTHS_EN[adMonth]} ${adYear}`,
      secondary: `${NEPALI_MONTHS_NP[mp.month]} ${toNepaliDigits(mp.year)}`,
    };
  }, [calPref, bsYear, bsMonth, adYear, adMonth, anchorDate]);

  const isPrevDisabled = calPref === "bs" ? atMinBs : atMinAd;
  const isNextDisabled = calPref === "bs" ? atMaxBs : atMaxAd;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Calendar size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Calendar</h1>
            <p className="text-xs text-slate-500 font-medium">{viewTitle.primary} · {viewTitle.secondary}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={prevMonth}
            disabled={isPrevDisabled}
            aria-label="Previous month"
            className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <ChevronLeft size={14} />
          </button>

          {calPref === "bs" ? (
            <>
              <select
                aria-label="Select BS year"
                value={bsYear}
                onChange={(e) => updateBsPeriod(Number(e.target.value), bsMonth)}
                className={selectCompact()}
              >
                {bsYearOptions.map((y) => <option key={y} value={y}>{toNepaliDigits(y)}</option>)}
              </select>
              <select
                aria-label="Select BS month"
                value={bsMonth}
                onChange={(e) => updateBsPeriod(bsYear, Number(e.target.value))}
                className={selectCompact()}
              >
                {bsMonthOptions.map((m) => <option key={m} value={m}>{NEPALI_MONTHS_NP[m]}</option>)}
              </select>
            </>
          ) : (
            <>
              <select
                aria-label="Select AD year"
                value={adYear}
                onChange={(e) => updateAdPeriod(Number(e.target.value), adMonth)}
                className={selectCompact()}
              >
                {adYearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                aria-label="Select AD month"
                value={adMonth}
                onChange={(e) => updateAdPeriod(adYear, Number(e.target.value))}
                className={selectCompact()}
              >
                {adMonthOptions.map((m) => <option key={m} value={m}>{AD_MONTHS_EN[m]}</option>)}
              </select>
            </>
          )}

          <button
            type="button"
            onClick={nextMonth}
            disabled={isNextDisabled}
            aria-label="Next month"
            className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <ChevronRight size={14} />
          </button>

          <div className="w-px h-6 bg-slate-200 mx-0.5" />

          <div className="flex items-center rounded-lg bg-white border border-slate-200 p-0.5 text-xs font-semibold">
            <button
              type="button"
              aria-pressed={calPref === "bs"}
              onClick={() => togglePref("bs")}
              className={`px-2.5 py-1 rounded-md transition-all ${calPref === "bs" ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
            >
              नेपाली
            </button>
            <button
              type="button"
              aria-pressed={calPref === "ad"}
              onClick={() => togglePref("ad")}
              className={`px-2.5 py-1 rounded-md transition-all ${calPref === "ad" ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Weekday headers - dual (Nepali + English) */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_BS.map((bs, i) => (
          <div key={bs} className="text-center py-2 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-xs font-bold text-slate-700">{bs}</div>
            <div className="text-[10px] text-slate-400 font-medium">{WEEKDAYS_AD_SHORT[i]}</div>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`pad-${i}`} />)}

          {gridDays.map((gd) => {
            const dayData = daysByDate.get(gd.adDateKey);
            const status = dayData?.status || "none";
            const attendStyle = STATUS_STYLES[status] || STATUS_STYLES.none;
            const dayHolidays = holidaysOn(gd.adDateKey);
            const dayEvents = eventsOn(gd.adDateKey);
            // weekend/holiday display backend status bata auncha (company weeklyHolidays setting anusar)
            const isOffDay = status === "holiday" || status === "weekend";
            const hasHoliday = dayHolidays.length > 0 || isOffDay;
            const isTodayCell = isToday(gd.adDateKey);

            const firstEvent = dayEvents.length > 0 ? dayEvents[0] : null;
            const evStyle = firstEvent ? (EVENT_TYPE_STYLE[firstEvent.type || "other"] || EVENT_TYPE_STYLE.other) : null;

            // company banauda aghi ko din - koi attendance/data hudaina
            const dateKey = toLocalDateInput(gd.adDate);
            const beforeCompany = createdDateKey != null && dateKey < createdDateKey;

            // priority: today > before-company no data > event > holiday/weekend > attendance > default
            let cellBg = "bg-white border-slate-200";
            let dateText = "text-slate-900";
            let subText = "text-slate-500";
            let badge: { text: string; cls: string } | null = null;

            if (isTodayCell) {
              cellBg = "bg-primary border-primary";
              dateText = "text-white";
              subText = "text-white/80";
              badge = { text: "Today", cls: "bg-white/25 text-white" };
            } else if (beforeCompany) {
              badge = { text: "No data", cls: "bg-slate-200 text-slate-500" };
            } else if (evStyle) {
              cellBg = `${evStyle.cell}`;
              dateText = evStyle.text;
              subText = evStyle.text;
              badge = { text: evStyle.label, cls: `${evStyle.solid} text-white` };
            } else if (hasHoliday) {
              cellBg = "bg-red-50 border-red-300";
              dateText = "text-red-600";
              subText = "text-red-500";
              badge = { text: "Holiday", cls: "bg-red-500 text-white" };
            } else if (hasAttendance && status !== "none") {
              cellBg = attendStyle.cell;
              dateText = attendStyle.text;
              subText = attendStyle.text;
              badge = { text: attendStyle.label, cls: `${attendStyle.solid} text-white` };
            }

            const primaryDate = calPref === "bs" ? toNepaliDigits(gd.primaryNum) : String(gd.primaryNum);
            const oppositeDate = calPref === "bs" ? String(gd.oppositeNum) : toNepaliDigits(gd.oppositeNum);
            const weekdayLabel = calPref === "bs" ? WEEKDAYS_BS[gd.weekdayIdx] : WEEKDAYS_AD[gd.weekdayIdx];

            return (
              <button
                key={gd.adDateKey}
                type="button"
                onClick={() => {
                  setAnchorDate(gd.adDate);
                  setSelected(dayData || { date: gd.adDateKey, status: "none", checkIn: null, checkOut: null, workingMinutes: 0, holidayTitle: null });
                }}
                className={`relative rounded-xl border p-1.5 min-h-[82px] flex flex-col items-center justify-center transition-all active:scale-[0.97] hover:shadow-md cursor-pointer ${cellBg} ${isTodayCell ? "ring-2 ring-primary/30 shadow-md" : ""}`}
              >
                {/* converted date - top right */}
                <span className={`absolute top-1 right-1.5 text-[10px] leading-none font-bold ${subText}`}>
                  {oppositeDate}
                </span>

                {/* event / status badge - top left */}
                {badge && (
                  <span className={`absolute top-1 left-1 max-w-[70%] truncate text-center text-[8px] font-bold uppercase tracking-tight leading-none px-1 py-0.5 rounded ${badge.cls}`}>
                    {badge.text}
                  </span>
                )}

                {/* day number */}
                <span className={`text-xl font-extrabold leading-none ${dateText}`}>{primaryDate}</span>

                {/* weekday */}
                <span className={`text-[10px] font-bold mt-1 ${subText}`}>{weekdayLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        {hasAttendance && (
          <>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Attendance</p>
              <LegendList styles={STATUS_STYLES} />
            </div>
            <div className="border-t border-slate-100" />
          </>
        )}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Events</p>
          <LegendList styles={EVENT_TYPE_STYLE} />
        </div>
        {weeklyHolidays.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Weekly Off</p>
            {weeklyHolidays.map((wd) => {
              const idx = WEEKDAYS_NAME.indexOf(wd);
              if (idx === -1) return null;
              return (
                <span key={wd} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-[11px] font-semibold text-red-600">
                  <Sun size={11} />
                  {calPref === "bs" ? WEEKDAYS_BS[idx] : WEEKDAYS_AD[idx]}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Holidays this month */}
      {monthHolidays.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
          <p className="text-sm font-bold text-slate-800">Holidays this month</p>
          {monthHolidays.map((h) => (
            <div key={h._id} className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-3">
              <Sun size={16} className="text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-800">{h.title}</p>
                <p className="text-[11px] text-slate-500">
                  {formatDateDual(new Date(h.startDate), calPref)}
                  {toLocalDateInput(new Date(h.endDate)) !== toLocalDateInput(new Date(h.startDate))
                    ? ` – ${formatDateDual(new Date(h.endDate), calPref)}`
                    : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Company events */}
      {events.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
          <p className="text-sm font-bold text-slate-800">Company Events</p>
          {events.map((e) => {
            const evStyle = EVENT_TYPE_STYLE[e.type || "other"] || EVENT_TYPE_STYLE.other;
            return (
              <div key={e._id} className={`flex items-start gap-3 rounded-xl ${evStyle.cell} border ${evStyle.border} p-3`}>
                <Plane size={16} className={`${evStyle.text} mt-0.5 shrink-0`} />
                <div>
                  <p className="text-xs font-semibold text-slate-800">{e.title}</p>
                  <p className="text-[11px] text-slate-500">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${evStyle.solid} text-white mr-1.5`}>{evStyle.label}</span>
                    {formatDateShort(new Date(e.date), calPref === "bs" ? "bs" : "ad")}{e.startTime ? ` · ${e.startTime}${e.endTime ? ` - ${e.endTime}` : ""}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Day detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setSelected(null)}>
          <div
            ref={detailModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Day details"
            tabIndex={-1}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 space-y-4 max-h-[85vh] overflow-y-auto outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                {(() => {
                  const selDate = parseLocalDate(selected.date);
                  const engFull = selDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
                  const nepFull = toBS(selDate);
                  return (
                    <>
                      <p className="font-bold text-lg text-slate-900">{calPref === "bs" ? nepFull : engFull}</p>
                      <p className="text-xs text-slate-400">{calPref === "bs" ? engFull : nepFull}</p>
                    </>
                  );
                })()}
              </div>
              {hasAttendance && selected.status !== "none" && (
                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${STATUS_STYLES[selected.status]?.solid} text-white`}>
                  {STATUS_STYLES[selected.status]?.label}
                </span>
              )}
            </div>

            {selectedBeforeCompany ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 text-center">
                <p className="text-sm font-bold text-slate-700">No data for this date</p>
                <p className="text-[11px] text-slate-400 mt-1">This date is before your company was created.</p>
              </div>
            ) : (
              <>
                {selected.holidayTitle && (
                  <p className="text-sm text-red-600 font-semibold">Holiday — {selected.holidayTitle}</p>
                )}

                {selectedHolidays.filter((h) => h.title !== selected.holidayTitle).map((h) => (
                  <div key={h._id} className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3">
                    <Sun size={15} className="text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{h.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatDateDual(new Date(h.startDate), calPref)}
                        {toLocalDateInput(new Date(h.endDate)) !== toLocalDateInput(new Date(h.startDate))
                          ? ` – ${formatDateDual(new Date(h.endDate), calPref)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                ))}

                {selected.status === "weekend" && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3">
                    <Sun size={15} className="text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Weekly Holiday</p>
                      <p className="text-[11px] text-slate-500">Company weekly off day — Office Closed</p>
                    </div>
                  </div>
                )}

                {selectedEvents.map((e) => {
                  const evStyle = EVENT_TYPE_STYLE[e.type || "other"] || EVENT_TYPE_STYLE.other;
                  return (
                    <div key={e._id} className={`flex items-start gap-2.5 rounded-xl ${evStyle.cell} border ${evStyle.border} p-3`}>
                      <Plane size={15} className={`${evStyle.text} mt-0.5 shrink-0`} />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{e.title}</p>
                        <p className="text-[11px] text-slate-500">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${evStyle.solid} text-white mr-1.5`}>{evStyle.label}</span>
                          {formatDateShort(new Date(e.date), calPref === "bs" ? "bs" : "ad")}{e.startTime ? ` · ${e.startTime}${e.endTime ? ` - ${e.endTime}` : ""}` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {hasAttendance && selected.checkIn && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                      <p className="text-[10px] text-emerald-600 uppercase font-bold">Check-in</p>
                      <p className="text-sm font-bold text-slate-800">{formatTime(selected.checkIn.time)}</p>
                    </div>
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                      <p className="text-[10px] text-rose-600 uppercase font-bold">Check-out</p>
                      <p className="text-sm font-bold text-slate-800">{formatTime(selected.checkOut?.time)}</p>
                    </div>
                    <div className="col-span-2 rounded-xl bg-primary/10 border border-primary/20 p-3 flex items-center justify-between">
                      <p className="text-[10px] text-primary uppercase font-bold">Working hours</p>
                      <p className="text-sm font-bold text-primary">{formatWorkingMinutes(selected.workingMinutes)}</p>
                    </div>
                  </div>
                )}

                {hasAttendance && !selected.checkIn && selected.status !== "holiday" && selected.status !== "weekend" && selectedEvents.length === 0 && selectedHolidays.length === 0 && (
                  <p className="text-sm text-slate-500">No attendance recorded for this day.</p>
                )}

                {!hasAttendance && selectedEvents.length === 0 && selectedHolidays.length === 0 && !selected.holidayTitle && (
                  <p className="text-sm text-slate-500">No events or holidays on this day.</p>
                )}
              </>
            )}

            <button onClick={() => setSelected(null)} className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
