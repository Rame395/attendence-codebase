import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, Wrench } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import { formatDate, formatTime } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import Pagination from "../../components/common/Pagination";

interface ICorrection {
  _id: string;
  employee?: { name: string; employeeId: string } | null;
  date: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  status: string;
  reviewReason?: string | null;
}

// admin correction requests - approve/reject garne
export default function Corrections() {
  const calPref = useCalendarPreference();
  const [requests, setRequests] = useState<ICorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(requests.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedRequests = requests.slice(start, start + pageSize);

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res: any = await axiosInstance.get("/corrections", {
        params: statusFilter ? { status: statusFilter } : {},
      });
      setRequests(res.data || []);
    } catch {
      toast.error("Failed to load correction requests");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    try {
      setReviewing(id);
      await axiosInstance.put(`/corrections/${id}/review`, { status });
      toast.success(`Request ${status}`);
      fetchRequests();
    } catch (error: any) {
      toast.error(error?.message || "Action failed");
    } finally {
      setReviewing(null);
    }
  };

  const statusBadge = (status: string) => ({
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-secondary text-primary",
    rejected: "bg-red-100 text-red-700",
  }[status] || "bg-slate-100 text-slate-600");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance Corrections</h1>
          <p className="mt-1 text-slate-500">Review employee time-fix requests</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white capitalize"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No {statusFilter || ""} correction requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Employee</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Requested Time</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Reason</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Status</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRequests.map((r) => (
                  <tr key={r._id} className="border-b border-slate-50 hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-800">{r.employee?.name || "Unknown"}</p>
                      <p className="text-[11px] text-slate-500">{r.employee?.employeeId || "-"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{formatDate(new Date(r.date), calPref)}</p>
                      <p className="text-[11px] text-slate-400">{formatDate(new Date(r.date), calPref === "bs" ? "ad" : "bs")}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {r.requestedCheckIn && <p>In: {formatTime(r.requestedCheckIn)}</p>}
                      {r.requestedCheckOut && <p>Out: {formatTime(r.requestedCheckOut)}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-[220px] truncate italic">"{r.reason}"</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium capitalize ${statusBadge(r.status)}`}>
                        {r.status === "pending" ? <Clock size={12} /> : r.status === "approved" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {r.status === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(r._id, "approved")}
                            disabled={reviewing === r._id}
                            className="px-3 py-1.5 rounded-lg bg-secondary text-primary text-xs font-semibold hover:bg-secondary-hover transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(r._id, "rejected")}
                            disabled={reviewing === r._id}
                            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && requests.length > 0 && (
          <Pagination page={page} pageSize={pageSize} total={requests.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemName="requests" />
        )}
      </div>
    </div>
  );
}
