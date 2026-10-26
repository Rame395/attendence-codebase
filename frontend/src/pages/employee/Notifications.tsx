import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Bell, CheckCheck, CalendarCheck, LogIn, LogOut, AlertCircle, Plane, Wrench, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import { formatDateTime, formatRelativeTime } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import Pagination from "../../components/common/Pagination";

interface INotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

// notification type anusar ko icon
const TYPE_ICONS: Record<string, any> = {
  check_in: LogIn,
  check_out: LogOut,
  late: AlertCircle,
  leave_requested: Plane,
  leave_approved: Plane,
  leave_rejected: Plane,
  correction_requested: Wrench,
  correction_approved: Wrench,
  correction_rejected: Wrench,
  missing_checkout: AlertCircle,
  early_checkout: Clock,
  event: CalendarCheck,
  info_update: Bell,
};

// notifications page - mark as read sahit
export default function Notifications() {
  const calPref = useCalendarPreference();
  const { refreshUnread } = useOutletContext<{ refreshUnread: () => void }>();
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const totalPages = Math.max(1, Math.ceil(notifications.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedNotifications = notifications.slice(start, start + pageSize);

  useEffect(() => {
    fetchNotifications();
    // list live rakha - naya notification aaye auto dekhincha (spinner bina)
    const interval = setInterval(() => {
      fetchNotifications(true);
      refreshUnread();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res: any = await axiosInstance.get("/notifications");
      setNotifications(res.data || []);
      setUnread(res.unread || 0);
    } catch {
      if (!silent) toast.error("Failed to load notifications");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await axiosInstance.put("/notifications/read-all");
      fetchNotifications();
      refreshUnread();
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const markRead = async (id: string) => {
    try {
      await axiosInstance.put(`/notifications/${id}/read`);
      fetchNotifications();
      refreshUnread();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      await axiosInstance.delete(`/notifications/${id}`);
      setNotifications((list) => list.filter((n) => n._id !== id));
      refreshUnread();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete notification");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAll = async () => {
    if (isClearing) return;
    try {
      setIsClearing(true);
      await axiosInstance.delete("/notifications/all");
      setNotifications([]);
      setUnread(0);
      refreshUnread();
      toast.success("All notifications cleared");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to clear notifications");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">
          Notifications {unread > 0 && <span className="ml-1 px-2 py-0.5 rounded-full bg-secondary text-primary text-xs font-bold">{unread}</span>}
        </h1>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => void handleClearAll()}
              disabled={isClearing || isDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={13} /> {isClearing ? "Clearing..." : "Clear All"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl bg-white border border-border p-10 text-center">
          <Bell size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">No notifications yet</p>
        </div>
      ) : (
        <>
        <div className="space-y-2.5">
          {pagedNotifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] || Bell;
            return (
              <button
                key={n._id}
                onClick={() => !n.isRead && markRead(n._id)}
                className={`w-full text-left rounded-2xl border p-4 flex items-start gap-3 transition-colors ${
                  n.isRead ? "bg-white border-border" : "bg-secondary/50 border-secondary"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.isRead ? "bg-slate-100 text-slate-500" : "bg-secondary text-primary"}`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.isRead ? "font-medium text-slate-700" : "font-bold text-slate-900"}`}>{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{formatRelativeTime(n.createdAt)} · {formatDateTime(new Date(n.createdAt), calPref)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary" />}
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleDelete(n._id); }}
                    disabled={isDeleting || isClearing}
                    className="p-1.5 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Delete notification"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </button>
            );
          })}
        </div>
        {notifications.length > 0 && (
          <Pagination page={page} pageSize={pageSize} total={notifications.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemName="notifications" />
        )}
        </>
      )}
    </div>
  );
}
