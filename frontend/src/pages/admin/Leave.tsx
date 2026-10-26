import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAppSelector, useAppDispatch } from "../../lib/hooks/redux";
import { getLeaves, approveLeave } from "../../lib/reducers/leave-reducer";
import { formatDate } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import Pagination from "../../components/common/Pagination";

// yo page le leave requests dekhauxa + approve/reject garna dinxa
export default function Leave() {
  const calPref = useCalendarPreference();
  const dispatch = useAppDispatch();
  const { leaveList, loading } = useAppSelector((state) => state.leave);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil((leaveList?.length ?? 0) / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedLeaves = (leaveList || []).slice(start, start + pageSize);

  useEffect(() => {
    dispatch(getLeaves());
  }, [dispatch]);

  // approve/reject action
  const handleReview = async (id: string, status: "approved" | "rejected") => {
    try {
      await dispatch(approveLeave({ id, status })).unwrap();
      toast.success(`Leave ${status}`);
    } catch (error: any) {
      toast.error(error?.message || "Action failed");
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { icon: any; classes: string }> = {
      approved: { icon: CheckCircle2, classes: "bg-secondary text-primary" },
      rejected: { icon: XCircle, classes: "bg-red-100 text-red-700" },
      pending: { icon: Clock, classes: "bg-amber-100 text-amber-700" },
    };
    return map[status] || { icon: Clock, classes: "bg-slate-100 text-slate-700" };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leave Requests</h1>
        <p className="mt-1 text-slate-500">Manage employee leave applications</p>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading leaves...</div>
        ) : !leaveList || leaveList.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No leave requests found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Employee</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Type</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">From</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">To</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Reason</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Status</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedLeaves.map((leave: any) => {
                  const badge = getStatusBadge(leave.status);
                  const BadgeIcon = badge.icon;
                  const empName = typeof leave.employee === "object" ? leave.employee?.name : "Unknown";
                  const empId = typeof leave.employee === "object" ? leave.employee?.employeeId : "";
                  return (
                    <tr key={leave._id} className="border-b border-slate-50 hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-800">{empName}</p>
                        <p className="text-[11px] text-slate-500">{empId}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 capitalize">{leave.leaveType || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{leave.startDate ? formatDate(new Date(leave.startDate), calPref) : "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{leave.endDate ? formatDate(new Date(leave.endDate), calPref) : "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-[200px] truncate">{leave.reason || "-"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium capitalize ${badge.classes}`}>
                          <BadgeIcon size={12} />
                          {leave.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {leave.status === "pending" ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReview(leave._id, "approved")}
                              className="px-3 py-1.5 rounded-lg bg-secondary text-primary text-xs font-semibold hover:bg-secondary-hover transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReview(leave._id, "rejected")}
                              className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (leaveList?.length ?? 0) > 0 && (
          <Pagination page={page} pageSize={pageSize} total={leaveList?.length ?? 0} onPageChange={setPage} onPageSizeChange={setPageSize} itemName="requests" />
        )}
      </div>
    </div>
  );
}
