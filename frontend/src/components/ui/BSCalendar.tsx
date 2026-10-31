import { useState, useMemo, useId } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import NepaliDate from "nepali-date-converter";
import { getBSDaysInMonth, toNepaliDigits, nepaliDigitsToAscii, bsToDate, getBSDateParts } from "../../lib/nepali-date";

const BS_MONTHS_NP = [
  "\u092C\u0948\u0936\u093E\u0916", "\u091C\u0947\u0920", "\u0905\u0938\u093E\u0930", "\u0936\u094D\u0930\u093E\u0935\u0923",
  "\u092D\u093E\u0926\u094D\u0930", "\u0906\u0936\u094D\u0935\u093F\u0928", "\u0915\u093E\u0930\u094D\u0924\u093F\u0915", "\u092E\u0902\u0938\u093F\u0930",
  "\u092A\u094C\u0937", "\u092E\u093E\u0918", "\u092B\u093E\u0932\u094D\u0917\u0941\u0928", "\u091A\u0948\u0924\u094D\u0930",
];

const WEEKDAYS = ["\u0906\u0907\u0924", "\u0938\u094B\u092E", "\u092E\u0919\u094D\u0917\u0932", "\u092C\u0941\u0927", "\u092C\u093F\u0939\u093F", "\u0936\u0941\u0915\u0930", "\u0936\u0928\u093F"];

interface BSCalendarProps {
  value?: Date | null;
  onChange: (date: Date) => void;
  min?: Date | null;
  max?: Date | null;
}

export default function BSCalendar({ value, onChange, min, max }: BSCalendarProps) {
  const baseId = useId();
  const todayParts = useMemo(() => getBSDateParts(new Date()), []);

  const initialParts = value ? getBSDateParts(value) : { year: todayParts.year, month: todayParts.month, date: 1 };
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);

  const selectedParts = value ? getBSDateParts(value) : null;

  // Manual BS date entry (day / month / year) - type garera sidai jump garna
  const [manualDay, setManualDay] = useState(selectedParts ? String(selectedParts.date) : "");
  const [manualMonth, setManualMonth] = useState(String(initialParts.month));
  const [manualYear, setManualYear] = useState(String(initialParts.year));
  const [manualError, setManualError] = useState<string | null>(null);

  const onlyDigits = (raw: string) => nepaliDigitsToAscii(raw).replace(/\D/g, "");

  const daysInMonth = getBSDaysInMonth(viewYear, viewMonth);

  // First day of month weekday (0=Sun)
  const firstDayWeekday = useMemo(() => {
    try {
      const d = new NepaliDate(viewYear, viewMonth, 1).toJsDate();
      return new NepaliDate(d).getDay();
    } catch {
      return 0;
    }
  }, [viewYear, viewMonth]);

  const gridDays = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [firstDayWeekday, daysInMonth]);

  const isDisabled = (day: number): boolean => {
    try {
      const thisDate = bsToDate(viewYear, viewMonth, day);
      if (min && thisDate < new Date(min.getFullYear(), min.getMonth(), min.getDate())) return true;
      if (max && thisDate > new Date(max.getFullYear(), max.getMonth(), max.getDate())) return true;
      return false;
    } catch {
      return false;
    }
  };

  const isToday = (day: number): boolean =>
    viewYear === todayParts.year && viewMonth === todayParts.month && day === todayParts.date;

  const isSelected = (day: number): boolean =>
    !!selectedParts && viewYear === selectedParts.year && viewMonth === selectedParts.month && day === selectedParts.date;

  const syncManualView = (year: number, month: number) => {
    setManualYear(String(year));
    setManualMonth(String(month));
    setManualError(null);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); syncManualView(viewYear - 1, 11); }
    else { setViewMonth(viewMonth - 1); syncManualView(viewYear, viewMonth - 1); }
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); syncManualView(viewYear + 1, 0); }
    else { setViewMonth(viewMonth + 1); syncManualView(viewYear, viewMonth + 1); }
  };

  // Manual entry apply - year/month ma view jump, day diyeko cha bhane validate
  const applyManualDate = () => {
    const y = Number(onlyDigits(manualYear));
    const m = Number(onlyDigits(manualMonth));
    const dayRaw = onlyDigits(manualDay);
    if (!y || manualYear.trim().length < 4 || Number.isNaN(m) || m < 0 || m > 11) {
      setManualError("Enter a valid BS year and month");
      return;
    }
    // converter le support nagarne year/month bhaye throw garxa
    let daysInMonth = 30;
    try {
      daysInMonth = getBSDaysInMonth(y, m);
      // validity check - invalid combo ma throw aawos bhanera
      void new NepaliDate(y, m, 1).toJsDate();
    } catch {
      setManualError("This BS month/year is not supported");
      return;
    }
    if (dayRaw) {
      const d = Number(dayRaw);
      if (!d || d < 1 || d > daysInMonth) {
        setManualError(`Day must be 1–${daysInMonth} for ${BS_MONTHS_NP[m]} ${y}`);
        return;
      }
      try {
        const thisDate = bsToDate(y, m, d);
        const dayOnly = new Date(thisDate.getFullYear(), thisDate.getMonth(), thisDate.getDate());
        if (min && dayOnly < new Date(min.getFullYear(), min.getMonth(), min.getDate())) {
          setManualError("Date is before the allowed range");
          return;
        }
        if (max && dayOnly > new Date(max.getFullYear(), max.getMonth(), max.getDate())) {
          setManualError("Date is after the allowed range");
          return;
        }
      } catch {
        setManualError("Invalid BS date");
        return;
      }
    }
    setViewYear(y);
    setViewMonth(m);
    setManualError(null);
  };

  const jumpToToday = () => {
    setViewYear(todayParts.year);
    setViewMonth(todayParts.month);
    setManualYear(String(todayParts.year));
    setManualMonth(String(todayParts.month));
    setManualDay(String(todayParts.date));
    setManualError(null);
  };

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} aria-label="Previous month" className="p-1.5 rounded-lg hover:bg-secondary/50 text-slate-500 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-800">
            {BS_MONTHS_NP[viewMonth]} {toNepaliDigits(viewYear)}
          </p>
        </div>
        <button type="button" onClick={nextMonth} aria-label="Next month" className="p-1.5 rounded-lg hover:bg-secondary/50 text-slate-500 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Manual BS date entry - day/month/year type garera jump */}
      <div className="mb-3 rounded-xl bg-slate-50 border border-slate-100 p-2">
        <div className="grid grid-cols-[1fr_1.4fr_1fr_auto] gap-1.5">
          <div>
            <label htmlFor={`${baseId}-day`} className="block text-[10px] font-semibold text-slate-400 mb-0.5">Day</label>
            <input
              id={`${baseId}-day`}
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="२६"
              value={manualDay}
              onChange={(e) => { setManualDay(onlyDigits(e.target.value).slice(0, 2)); setManualError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") applyManualDate(); }}
              className="w-full border border-border rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:border-primary bg-white"
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-month`} className="block text-[10px] font-semibold text-slate-400 mb-0.5">Month</label>
            <select
              id={`${baseId}-month`}
              value={manualMonth}
              onChange={(e) => { setManualMonth(e.target.value); setManualError(null); }}
              className="w-full border border-border rounded-lg px-1.5 py-1.5 text-sm outline-none focus:border-primary bg-white"
            >
              {BS_MONTHS_NP.map((name, idx) => (
                <option key={name} value={idx}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${baseId}-year`} className="block text-[10px] font-semibold text-slate-400 mb-0.5">Year</label>
            <input
              id={`${baseId}-year`}
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="२०८३"
              value={manualYear}
              onChange={(e) => { setManualYear(onlyDigits(e.target.value).slice(0, 4)); setManualError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") applyManualDate(); }}
              className="w-full border border-border rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:border-primary bg-white"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={applyManualDate}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Go
            </button>
          </div>
        </div>
        {manualError ? (
          <p className="text-[11px] text-red-500 mt-1.5">{manualError}</p>
        ) : (
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-slate-400">Type BS date to jump (Nepali or English digits)</p>
            <button
              type="button"
              onClick={jumpToToday}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <CalendarCheck size={12} /> Today
            </button>
          </div>
        )}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-center text-[10px] font-semibold text-slate-400 py-1">{wd}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {gridDays.map((day, i) => (
          <div key={i} className="aspect-square flex items-center justify-center">
            {day ? (
              <button
                type="button"
                disabled={isDisabled(day)}
                onClick={() => {
                  const selectedDate = bsToDate(viewYear, viewMonth, day);
                  onChange(selectedDate);
                }}
                className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                  isSelected(day)
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : isToday(day)
                      ? "bg-secondary text-primary font-bold ring-2 ring-primary/30"
                      : isDisabled(day)
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-700 hover:bg-secondary/40"
                }`}
              >
                {toNepaliDigits(day)}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {/* Today AD reference */}
      <div className="mt-2 pt-2 border-t border-slate-100 text-center">
        <p className="text-[10px] text-slate-400">
          Today: {toNepaliDigits(todayParts.date)} {BS_MONTHS_NP[todayParts.month]} {toNepaliDigits(todayParts.year)}
        </p>
      </div>
    </div>
  );
}
