import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Sun, PartyPopper } from "lucide-react";
import axiosInstance from "../../config/ApiClient";
import { formatDateDual, formatDateShort } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import { useAppSelector } from "../../lib/hooks/redux";
import { fetchHolidayViewer, isHolidayApplicable, type IHolidayLike, type IHolidayViewer } from "../../lib/holidayScope";
import Pagination from "../../components/common/Pagination";

const WEEKDAYS_NAME = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAYS_NP = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// event type anusar ko color
const TYPE_STYLES: Record<string, string> = {
  holiday: "bg-pink-50 border-pink-200 text-pink-700",
  company_event: "bg-secondary border-secondary text-primary",
  staff_training: "bg-secondary border-secondary text-primary",
  meeting: "bg-secondary border-secondary text-primary",
  other: "bg-secondary-muted/30 border-border text-slate-600",
};

interface IEvent {
  _id: string;
  title: string;
  type: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
}

type IHoliday = IHolidayLike;

// company events page
export default function CompanyEvents() {
  const calPref = useCalendarPreference();
  const weeklyHolidays = useAppSelector((state) => state.companySetting.settings.weeklyHolidays);
  const [events, setEvents] = useState<IEvent[]>([]);
  const [holidays, setHolidays] = useState<IHoliday[]>([]);
  const [viewer, setViewer] = useState<IHolidayViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [eventPage, setEventPage] = useState(1);
  const [holidayPage, setHolidayPage] = useState(1);
  const [eventPageSize, setEventPageSize] = useState(6);
  const [holidayPageSize, setHolidayPageSize] = useState(6);
  // viewer lai nalagne holiday (e.g. female-only male lai) lukaune
  const visibleHolidays = useMemo(() => holidays.filter((h) => isHolidayApplicable(h, viewer)), [holidays, viewer]);
  const eventTotalPages = Math.max(1, Math.ceil(events.length / eventPageSize));
  const safeEventPage = Math.min(eventPage, eventTotalPages);
  const eventStart = (safeEventPage - 1) * eventPageSize;
  const pagedEvents = events.slice(eventStart, eventStart + eventPageSize);
  const holidayTotalPages = Math.max(1, Math.ceil(visibleHolidays.length / holidayPageSize));
  const safeHolidayPage = Math.min(holidayPage, holidayTotalPages);
  const holidayStart = (safeHolidayPage - 1) * holidayPageSize;
  const pagedHolidays = visibleHolidays.slice(holidayStart, holidayStart + holidayPageSize);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [eventRes, holidayRes, holidayViewer] = (await Promise.all([
          axiosInstance.get("/events"),
          axiosInstance.get("/holidays"),
          fetchHolidayViewer(),
        ])) as unknown as [{ data: IEvent[] }, { data: IHoliday[] }, IHolidayViewer | null];
        if (!active) return;
        setEvents(eventRes.data || []);
        setHolidays(holidayRes.data || []);
        setViewer(holidayViewer);
        setHolidayPage(1);
        setFailed(false);
      } catch (exception) {
        const status = (exception as { response?: { status?: number } })?.response?.status;
        if (active && status !== 401) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoading(true);
    setFailed(false);
    // re-trigger the load effect
    setReloadKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Company Calendar</h1>

      {failed && (
        <div className="flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm text-amber-700">Couldn't load events. Please try again.</p>
          <button
            onClick={retry}
            className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* upcoming events */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
          <CalendarDays size={15} className="text-primary" /> Events & Trainings
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400 rounded-2xl bg-white border border-border p-6 text-center">No events scheduled</p>
        ) : (
          <>
            {pagedEvents.map((e) => (
            <div key={e._id} className={`rounded-2xl border p-4 ${TYPE_STYLES[e.type] || TYPE_STYLES.other}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{e.title}</p>
                  <p className="text-xs opacity-80 mt-0.5">
                    {formatDateDual(new Date(e.date), calPref)}
                    {e.startTime && ` · ${e.startTime}${e.endTime ? ` - ${e.endTime}` : ""}`}
                  </p>
                  {e.location && <p className="text-xs opacity-70 mt-0.5">Location: {e.location}</p>}
                  {e.description && <p className="text-xs opacity-70 mt-1">{e.description}</p>}
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white/70 text-[10px] font-semibold capitalize whitespace-nowrap">
                  {e.type.replace("_", " ")}
                </span>
              </div>
            </div>
            ))}
            {events.length > 0 && (
              <Pagination page={eventPage} pageSize={eventPageSize} total={events.length} onPageChange={setEventPage} onPageSizeChange={setEventPageSize} itemName="events" />
            )}
          </>
        )}
      </section>

      {/* weekly off days - company settings bata */}
      {weeklyHolidays.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
            <Sun size={15} className="text-pink-500" /> Weekly Off Days
          </h2>
          <div className="flex flex-wrap gap-2">
            {weeklyHolidays.map((wd) => {
              const idx = WEEKDAYS_NAME.indexOf(wd);
              if (idx === -1) return null;
              return (
                <span key={wd} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600">
                  <Sun size={12} /> {calPref === "bs" ? WEEKDAYS_NP[idx] : WEEKDAYS_EN[idx]}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* holidays */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
          <Sun size={15} className="text-pink-500" /> Holidays
        </h2>
        {visibleHolidays.length === 0 ? (
          <p className="text-sm text-slate-400 rounded-2xl bg-white border border-border p-6 text-center">No holidays listed</p>
        ) : (
          <>
            {pagedHolidays.map((h) => (
            <div key={h._id} className="rounded-2xl bg-red-50 border border-red-100 p-4 flex items-start gap-3">
              <PartyPopper size={16} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">{h.title}</p>
                <p className="text-xs text-red-500/80 mt-0.5">
                  {h.startDate === h.endDate
                    ? formatDateDual(new Date(h.startDate), calPref)
                    : `${formatDateShort(new Date(h.startDate), calPref)} - ${formatDateDual(new Date(h.endDate), calPref)}`}
                </p>
                {h.gender && h.gender !== "both" && (
                  <p className="text-[11px] text-pink-500 font-medium mt-0.5">{h.gender === "female" ? "Women only" : "Men only"}</p>
                )}
                <p className="text-[11px] text-red-400 mt-0.5">Holiday - Office Closed</p>
              </div>
            </div>
            ))}
            {visibleHolidays.length > 0 && (
              <Pagination page={holidayPage} pageSize={holidayPageSize} total={visibleHolidays.length} onPageChange={setHolidayPage} onPageSizeChange={setHolidayPageSize} itemName="holidays" />
            )}
          </>
        )}
      </section>
    </div>
  );
}
