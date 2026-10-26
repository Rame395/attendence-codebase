import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LogIn,
  LogOut,
  MapPin,
  CheckCircle2,
  TrendingUp,
  Wrench,
  CalendarDays,
  CalendarCheck,
  Bell,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import { useTodayHoliday } from "../../lib/hooks/useTodayHoliday";
import { formatDateDual, formatWorkingMinutes, formatTime } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import PWAInstallBanner from "../../components/pwa/PWAInstallBanner";
import Avatar from "../../components/common/Avatar";
import LocationConfirmDialog from "../../components/common/LocationConfirmDialog";

interface ITodayStatus {
  checkedIn: boolean;
  checkedOut: boolean;
  today: {
    _id: string;
    checkIn?: { time: string; distance: number; accuracy: number };
    checkOut?: { time: string; distance: number; accuracy: number };
    status: string;
    workingMinutes: number;
    branch?: { name: string; latitude: number; longitude: number; geofenceRadius: number };
  } | null;
}

interface IRate {
  workingDays: number;
  presentDays: number;
  late: number;
  absent: number;
  leave: number;
  rate: number;
}

const quickLinks = [
  { to: "/employee/corrections", label: "Correction", desc: "Fix wrong time", icon: Wrench, color: "brand" },
  { to: "/employee/events", label: "Events", desc: "Company calendar", icon: CalendarDays, color: "brand" },
  { to: "/employee/leaves", label: "My Leaves", desc: "Requests & balance", icon: CalendarCheck, color: "brand" },
  { to: "/employee/notifications", label: "Notifications", desc: "Latest updates", icon: Bell, color: "brand" },
] as const;

const colorMap: Record<string, string> = {
  brand: "bg-secondary text-primary",
  orange: "bg-orange-50 text-orange-500",
  purple: "bg-secondary text-primary",
  sky: "bg-secondary text-primary",
  amber: "bg-amber-50 text-amber-500",
};

// employee dashboard
export default function EmployeeDashboard() {
  const calPref = useCalendarPreference();
  const [status, setStatus] = useState<ITodayStatus>({ checkedIn: false, checkedOut: false, today: null });
  const [rate, setRate] = useState<IRate | null>(null);
  const [employeeName, setEmployeeName] = useState<string>("");
  const [employeeImage, setEmployeeImage] = useState<{ url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"checkin" | "checkout">("checkin");
  // aaja lagne holiday - check-in button ko satta notice
  const { holiday: todayHoliday } = useTodayHoliday();

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // initial load - effect le ek choti data tanchha (refresh garda pani fetchData call hunchha)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [statusRes, rateRes] = (await Promise.all([
          axiosInstance.get("/attendance/today"),
          axiosInstance.get("/attendance/rate"),
        ])) as unknown as [{ data: ITodayStatus }, { data: IRate }];
        if (!active) return;
        setStatus(statusRes.data);
        setRate(rateRes.data);

        // employee naam /employees/me bata - username lai priority
        const meRes = (await axiosInstance.get("/employees/me").catch(() => null)) as unknown as {
          data?: { username?: string | null; employee?: { name?: string; profileImage?: { url: string } | null } | null };
        } | null;
        if (active && (meRes?.data?.username || meRes?.data?.employee?.name)) {
          setEmployeeName(meRes.data.username || meRes.data.employee!.name!);
          setEmployeeImage(meRes.data.employee?.profileImage || null);
        }
      } catch {
        if (active) toast.error("Failed to load attendance status");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, rateRes] = (await Promise.all([
        axiosInstance.get("/attendance/today"),
        axiosInstance.get("/attendance/rate"),
      ])) as unknown as [{ data: ITodayStatus }, { data: IRate }];
      setStatus(statusRes.data);
      setRate(rateRes.data);

      // employee naam /employees/me bata - username lai priority
      const meRes = (await axiosInstance.get("/employees/me").catch(() => null)) as unknown as {
        data?: { username?: string | null; employee?: { name?: string; profileImage?: { url: string } | null } | null };
      } | null;
      if (meRes?.data?.username || meRes?.data?.employee?.name) {
        setEmployeeName(meRes.data.username || meRes.data.employee!.name!);
        setEmployeeImage(meRes.data.employee?.profileImage || null);
      }
    } catch {
      toast.error("Failed to load attendance status");
    } finally {
      setLoading(false);
    }
  }, []);

  // GPS lincha ra backend lai pathaucha - backend le nai geofence verify garxa
  const handleConfirm = async (location: { latitude: number; longitude: number; accuracy: number }) => {
    try {
      setSubmitting(true);
      setConfirmOpen(false);
      if (confirmAction === "checkin") {
        await axiosInstance.post("/attendance/check-in", location);
        toast.success("Check-in successful! Location verified.");
      } else {
        const res = (await axiosInstance.post("/attendance/check-out", location)) as unknown as {
          data?: { status?: string };
        };
        if (res?.data?.status === "absent") {
          toast.error("Checked out, but minimum working minutes not completed - marked absent.");
        } else {
          toast.success("Check-out successful!");
        }
      }
      fetchData();
    } catch (error) {
      toast.error((error as { message?: string })?.message || (confirmAction === "checkin" ? "Check-in failed" : "Check-out failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const openConfirm = (action: "checkin" | "checkout") => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const now = clock;
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  // name nabhaye matra fallback
  const fullName = employeeName || "there";
  const firstName = fullName.split(" ")[0];

  // check-in bhayeko chha tara checkout baki chha bhane live working minutes
  const liveMinutes =
    status.today?.checkIn?.time && !status.checkedOut
      ? Math.max(0, Math.round((now.getTime() - new Date(status.today.checkIn.time).getTime()) / 60000))
      : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* PWA install — employee-only, gated inside component */}
      <PWAInstallBanner variant="banner" />

      {/* header - greeting + avatar (photo preview) */}
      <div className="flex items-center gap-4">
        <Avatar name={firstName} imageUrl={employeeImage} size="md" className="shadow-lg shadow-primary/20 ring-1 ring-secondary/30" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">
            {greeting}, <span className="text-primary">{firstName}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{formatDateDual(now, calPref)}</p>
        </div>
      </div>

      {/* hero check-in card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-hover to-primary-active p-6 text-white shadow-xl border border-white/10">
        {/* decorative glow */}
        <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-secondary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative">
          {/* top row - branch geofence info */}
          <div className="flex items-center justify-between mb-5">
            {status.today?.branch ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur text-[11px] font-medium text-secondary border border-white/10">
                <MapPin size={11} />
                {status.today.branch.name} · {status.today.branch.geofenceRadius}m zone
              </span>
            ) : (
              <span />
            )}
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums tracking-tight">
                {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">
                {now.toLocaleDateString("en-US", { weekday: "long" })}
              </p>
            </div>
          </div>

          {!status.checkedIn ? (
            todayHoliday ? (
              <>
                <p className="text-sm text-secondary flex items-center gap-1.5 font-semibold">
                  <CalendarDays size={14} /> Today is {todayHoliday.title} — Office closed
                </p>
                <p className="text-xs text-white/60 mt-1">Enjoy your holiday! Check-in is disabled today.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300">You have not checked in yet</p>
                <button
                  onClick={() => openConfirm("checkin")}
                  disabled={submitting}
                  className="group mt-4 w-full py-4 rounded-2xl bg-secondary text-primary hover:bg-secondary-hover active:scale-[0.98] transition-all font-bold text-base tracking-wide disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-black/10"
                >
                  <LogIn size={19} className="transition-transform group-hover:translate-x-0.5" />
                  {submitting ? "Submitting..." : "CHECK IN"}
                </button>
              </>
            )
          ) : !status.checkedOut ? (
            <>
              {/* timeline - checkin -> checkout */}
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary ring-4 ring-secondary/20" />
                <div className="flex-1 border-t border-dashed border-white/20 relative">
                  <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-slate-300 tabular-nums">
                    {liveMinutes != null ? formatWorkingMinutes(liveMinutes) : ""}
                  </span>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs text-secondary flex items-center gap-1"><CheckCircle2 size={12} /> Checked in</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">{formatTime(status.today?.checkIn?.time)}</p>
                  <p className="text-[11px] text-white/60">{status.today?.checkIn?.distance != null ? `${status.today.checkIn.distance}m from office` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/60">Check out</p>
                  <p className="text-2xl font-bold mt-1 text-white/40">--:--</p>
                </div>
              </div>

              <button
                onClick={() => openConfirm("checkout")}
                disabled={submitting}
                className="group mt-5 w-full py-4 rounded-2xl bg-white text-primary hover:bg-secondary active:scale-[0.98] transition-all font-bold text-base tracking-wide disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-black/10"
              >
                <LogOut size={19} className="transition-transform group-hover:translate-x-0.5" />
                {submitting ? "Submitting..." : "CHECK OUT"}
              </button>
            </>
          ) : (
            <>
              {/* day complete summary */}
              <p className="text-sm text-secondary flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Day complete — see you tomorrow!
              </p>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="rounded-2xl bg-white/10 border border-white/10 p-3 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-wider text-white/60">In</p>
                  <p className="text-lg font-bold mt-0.5 tabular-nums">{formatTime(status.today?.checkIn?.time)}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 p-3 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-wider text-white/60">Out</p>
                  <p className="text-lg font-bold mt-0.5 tabular-nums">{formatTime(status.today?.checkOut?.time)}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 p-3 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-wider text-white/60">Worked</p>
                  <p className="text-lg font-bold mt-0.5 text-secondary">{formatWorkingMinutes(status.today?.workingMinutes ?? 0)}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* today's status pill */}
      {status.today?.status && (
        <div className="flex items-center gap-2 rounded-2xl bg-white border border-border p-4 shadow-sm">
          <span className={`w-2 h-2 rounded-full ${["present", "late"].includes(status.today.status) ? "bg-primary" : status.today.status === "half_day" ? "bg-orange-500" : "bg-slate-400"}`} />
          <span className="text-sm text-slate-600">Today's status:</span>
          <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold capitalize ${
            ["present", "late"].includes(status.today.status) ? "bg-secondary text-primary" :
            status.today.status === "half_day" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700"
          }`}>
            {status.today.status.replace("_", " ")}
          </span>
        </div>
      )}

      {/* quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickLinks.map(({ to, label, desc, icon: Icon, color }) => (
          <NavLink
            key={to}
            to={to}
            className="group rounded-2xl bg-white border border-border p-4 hover:border-primary/30 hover:shadow-md hover:bg-secondary-muted/30 transition-all"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
              <Icon size={16} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800 flex items-center gap-1">
              {label}
              <ChevronRight size={13} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </p>
            <p className="text-[11px] text-slate-400">{desc}</p>
          </NavLink>
        ))}
      </div>

      {/* monthly attendance rate */}
      {rate && (
        <div className="rounded-2xl bg-white border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" /> This month
            </p>
            <p className="text-lg font-bold text-primary">{rate.rate}%</p>
          </div>
          <div className="h-2.5 rounded-full bg-secondary-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, rate.rate)}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4 text-center">
            <div className="rounded-xl bg-secondary py-2"><p className="text-base font-bold text-primary">{rate.presentDays}</p><p className="text-[10px] text-primary/70">Present</p></div>
            <div className="rounded-xl bg-amber-50 py-2"><p className="text-base font-bold text-amber-600">{rate.late}</p><p className="text-[10px] text-amber-600/70">Late</p></div>
            <div className="rounded-xl bg-secondary py-2"><p className="text-base font-bold text-primary">{rate.leave}</p><p className="text-[10px] text-primary/70">Leave</p></div>
            <div className="rounded-xl bg-red-50 py-2"><p className="text-base font-bold text-red-500">{rate.absent}</p><p className="text-[10px] text-red-500/70">Absent</p></div>
          </div>
        </div>
      )}

      <LocationConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        label={confirmAction === "checkin" ? "Check In" : "Check Out"}
      />
    </div>
  );
}
