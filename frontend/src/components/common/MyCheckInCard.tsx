import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, MapPin, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import { getErrorMessage } from "../../lib/getErrorMessage";
import { useTodayHoliday } from "../../lib/hooks/useTodayHoliday";
import { formatTime } from "../../lib/nepali-date";
import LocationConfirmDialog from "./LocationConfirmDialog";

interface ITodayStatus {
  checkedIn: boolean;
  checkedOut: boolean;
  today: {
    _id: string;
    checkIn?: { time: string; distance?: number };
    checkOut?: { time: string; distance?: number };
    status: string;
    workingMinutes: number;
  } | null;
}

// manager / hr_admin le aafai check-in/out garne card (admin dashboard ma)
export default function MyCheckInCard() {
  const [status, setStatus] = useState<ITodayStatus>({ checkedIn: false, checkedOut: false, today: null });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"checkin" | "checkout">("checkin");
  // aaja lagne holiday - check-in button ko satta notice
  const { holiday: todayHoliday } = useTodayHoliday();

  const fetchStatus = useCallback(async (silent = false) => {
    try {
      const res = (await axiosInstance.get("/attendance/today")) as unknown as { data: ITodayStatus };
      setStatus(res.data);
      setUnavailable(false);
    } catch (error) {
      const msg = getErrorMessage(error, "");
      if (msg.toLowerCase().includes("employee profile")) {
        setUnavailable(true);
      } else if (!silent) {
        toast.error(msg || "Failed to load today's status");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (active) await fetchStatus();
    })();
    return () => {
      active = false;
    };
  }, [fetchStatus]);

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
      fetchStatus(true);
    } catch (error) {
      toast.error(getErrorMessage(error, confirmAction === "checkin" ? "Check-in failed" : "Check-out failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const openConfirm = (action: "checkin" | "checkout") => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-border p-5 flex items-center gap-3 text-slate-500 text-sm">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Loading your attendance...
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="rounded-2xl bg-white border border-border p-5 text-sm text-slate-500">
        Check-in is not available for this account (no employee profile linked).
      </div>
    );
  }

  const done = status.checkedIn && status.checkedOut;

  return (
    <>
      <div className="rounded-2xl bg-primary p-5 sm:p-6 text-white shadow-lg shadow-primary/20">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest text-white/60 font-semibold">My Attendance Today</p>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {!status.checkedIn ? (
                todayHoliday ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                    <MapPin size={14} /> Today is {todayHoliday.title} — Office closed, enjoy your holiday!
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white/85">
                    <MapPin size={14} /> You haven't checked in yet
                  </span>
                )
              ) : done ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <CheckCircle2 size={15} /> Done for today
                  {status.today?.workingMinutes ? <span className="text-white/70">· {(status.today.workingMinutes / 60).toFixed(1)}h worked</span> : null}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" /> Checked in
                  {status.today?.checkIn?.time ? <span className="text-white/70">at {formatTime(status.today.checkIn.time)}</span> : null}
                  <span className="text-white/70">· tap Check Out when you leave</span>
                </span>
              )}
            </div>
            {status.today?.checkOut?.time && (
              <p className="text-[11px] text-white/60 mt-1">
                In {status.today?.checkIn?.time ? formatTime(status.today.checkIn.time) : "-"} · Out {formatTime(status.today.checkOut.time)}
              </p>
            )}
          </div>
          {!done && !(todayHoliday && !status.checkedIn) ? (
            <button
              onClick={() => openConfirm(status.checkedIn ? "checkout" : "checkin")}
              disabled={submitting}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-primary text-sm font-bold shadow hover:scale-[1.02] transition-all disabled:opacity-60 disabled:pointer-events-none"
            >
              {status.checkedIn ? <LogOut size={16} /> : <LogIn size={16} />}
              {submitting ? "Submitting..." : status.checkedIn ? "Check Out" : "Check In"}
            </button>
          ) : null}
        </div>
      </div>

      <LocationConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        label={confirmAction === "checkin" ? "Check In" : "Check Out"}
      />
    </>
  );
}
