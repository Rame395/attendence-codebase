import { useCallback, useEffect, useState } from "react";
import { History, ShieldCheck, Filter, Trash2, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import { formatDate, parseLocalDate, toLocalDateInput } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import Pagination from "../../components/common/Pagination";

interface IAuditLog {
  _id: string;
  performedByName?: string | null;
  performedBy?: { email: string; role: string; username?: string | null; employee?: { name?: string } | null } | null;
  action: string;
  module: string;
  employee?: { name: string; employeeId: string } | null;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  reason?: string | null;
  createdAt: string;
}

const MODULES = [
  { value: "attendance", label: "Attendance" },
  { value: "employee", label: "Employee" },
  { value: "user", label: "User" },
  { value: "branch", label: "Branch" },
  { value: "department", label: "Department" },
  { value: "designation", label: "Designation" },
  { value: "event", label: "Event" },
  { value: "holiday", label: "Holiday" },
  { value: "leave", label: "Leave" },
  { value: "settings", label: "Settings" },
  { value: "audit", label: "Audit" },
];

const ACTIONS = [
  "Attendance Created",
  "Attendance Modified",
  "Correction Requested",
  "Correction Approved",
  "Correction Rejected",
  "Employee Created",
  "Employee Updated",
  "Employee Deleted",
  "User Created",
  "User Updated",
  "User Deleted",
  "Branch Created",
  "Branch Updated",
  "Branch Deleted",
  "Department Created",
  "Department Updated",
  "Department Deleted",
  "Designation Created",
  "Designation Updated",
  "Designation Deleted",
  "Event Created",
  "Event Updated",
  "Event Deleted",
  "Holiday Created",
  "Holiday Updated",
  "Holiday Deleted",
  "Leave Requested",
  "Leave Approved",
  "Leave Rejected",
  "Leave Deleted",
  "Settings Updated",
  "Audit Log Deleted",
  "Audit History Cleared",
];

// audit history page
export default function AuditLogs() {
  const calPref = useCalendarPreference();
  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedLogs = logs.slice(start, start + pageSize);

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatExactTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const dateFormatted = formatDate(d, calPref);
      const timeFormatted = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      return `${dateFormatted} ${timeFormatted}`;
    } catch {
      return dateStr;
    }
  };

  const formatValue = (v: any): string => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      try {
        const d = new Date(v);
        return `${toLocalDateInput(d)} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
      } catch {
        return v;
      }
    }
    return String(v);
  };

  const getComparisonKeys = (oldData?: Record<string, any> | null, newData?: Record<string, any> | null) => {
    const keys = new Set<string>();
    if (oldData && typeof oldData === "object") Object.keys(oldData).forEach((k) => keys.add(k));
    if (newData && typeof newData === "object") Object.keys(newData).forEach((k) => keys.add(k));
    return Array.from(keys);
  };

  const fetchLogs = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      const res = (await axiosInstance.get("/audit-logs", { params })) as { data: IAuditLog[] };
      setLogs(res.data || []);
    } catch (error) {
      toast.error((error as { message?: string })?.message || "Failed to load audit logs");
    }
  }, [moduleFilter, actionFilter]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await fetchLogs();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [fetchLogs]);

  // delete icon thichyo bhane popup bina ekaichoti tyo log delete huncha
  const handleDelete = async (log: IAuditLog) => {
    try {
      setIsDeleting(true);
      await axiosInstance.delete(`/audit-logs/${log._id}`);
      toast.success("Audit log deleted");
      void fetchLogs();
    } catch (error) {
      toast.error((error as { message?: string })?.message || "Failed to delete audit log");
    } finally {
      setIsDeleting(false);
    }
  };

  // clear all thichyo bhane popup bina sabai history delete huncha
  const handleClearAll = async () => {
    if (isClearing) return;
    try {
      setIsClearing(true);
      await axiosInstance.delete("/audit-logs");
      toast.success("Audit history cleared");
      void fetchLogs();
    } catch (error) {
      toast.error((error as { message?: string })?.message || "Failed to clear audit history");
    } finally {
      setIsClearing(false);
    }
  };

  // user display name - snapshot, employee, username, natra role label
  const roleLabel = (role?: string) => {
    const map: Record<string, string> = {
      platform_admin: "Platform Admin",
      super_admin: "Super Admin",
      hr_admin: "HR Admin",
      manager: "Manager",
      employee: "Employee",
    };
    return (role && map[role]) || null;
  };

  const userDisplayName = (log: IAuditLog) => {
    const user = log.performedBy;
    return (
      log.performedByName ||
      user?.employee?.name ||
      user?.username ||
      roleLabel(user?.role) ||
      user?.email ||
      "system"
    );
  };

  // module ko color
  const moduleColor = (mod: string) => {
    const map: Record<string, string> = {
      attendance: "bg-secondary text-primary",
      employee: "bg-secondary text-primary",
      user: "bg-secondary text-primary",
      branch: "bg-secondary text-primary",
      department: "bg-secondary text-primary",
      designation: "bg-secondary text-primary",
      event: "bg-blue-50 text-blue-700",
      holiday: "bg-pink-50 text-pink-700",
      leave: "bg-amber-100 text-amber-700",
      settings: "bg-slate-100 text-slate-600",
      audit: "bg-purple-50 text-purple-700",
    };
    return map[mod] || "bg-slate-100 text-slate-600";
  };

  const targetSummary = (log: IAuditLog) => {
    const src = log.newData || log.oldData;
    if (!src) return null;
    return src.name || src.title || src.companyName || src.email || null;
  };

  // action ko icon color
  const actionIcon = (action: string) => {
    if (action.includes("Created")) return "bg-secondary text-primary";
    if (action.includes("Updated") || action.includes("Modified")) return "bg-secondary text-primary";
    if (action.includes("Deleted") || action.includes("Cleared")) return "bg-red-50 text-red-600";
    if (action.includes("Approved")) return "bg-secondary text-primary";
    if (action.includes("Rejected")) return "bg-red-50 text-red-600";
    return "bg-secondary-muted/30 text-slate-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit History</h1>
          <p className="mt-1 text-slate-500">Record of all important system actions</p>
        </div>
        <button
          onClick={() => void handleClearAll()}
          disabled={logs.length === 0 || isClearing || isDeleting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-medium text-sm hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} /> {isClearing ? "Clearing..." : "Clear All"}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-border p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
        </div>
        <select
          aria-label="Filter by module"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary bg-white capitalize"
        >
          <option value="">All Modules</option>
          {MODULES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select
          aria-label="Filter by action"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary bg-white"
        >
          <option value="">All Actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {(moduleFilter || actionFilter) && (
          <button
            onClick={() => { setModuleFilter(""); setActionFilter(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Log entries */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <History size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No audit records found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {pagedLogs.map((log) => {
              const expanded = expandedLogIds.has(log._id);
              const attDate = log.newData?.attendanceDate || log.newData?.date || log.oldData?.attendanceDate || log.oldData?.date;
              const hasDetails = Boolean(log.oldData || log.newData);

              return (
                <div key={log._id} className="px-6 py-4 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${actionIcon(log.action)}`}>
                      <ShieldCheck size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{log.action}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${moduleColor(log.module)}`}>
                          {log.module}
                        </span>
                        {attDate && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            <Calendar size={11} />
                            Attendance Date: {formatDate(parseLocalDate(attDate) || new Date(attDate), calPref)} ({formatDate(parseLocalDate(attDate) || new Date(attDate), "ad")})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        By <span className="font-medium">{userDisplayName(log)}</span>
                        {log.employee ? (
                          <> · Employee: <span className="font-medium">{log.employee.name}</span> ({log.employee.employeeId})</>
                        ) : targetSummary(log) ? (
                          <> · Target: <span className="font-medium">{targetSummary(log)}</span></>
                        ) : null}
                        {log.reason && <> · Reason: <span className="italic text-slate-700 font-medium">{log.reason}</span></>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {formatExactTime(log.createdAt)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      {hasDetails && (
                        <button
                          onClick={() => toggleExpand(log._id)}
                          aria-label={expanded ? "Hide changes" : "View changes"}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-slate-600 hover:border-primary hover:text-primary transition-colors"
                        >
                          <span>{expanded ? "Hide" : "Details"}</span>
                          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      )}
                      <button
                        onClick={() => void handleDelete(log)}
                        disabled={isDeleting || isClearing}
                        aria-label={`Delete audit log ${log.action}`}
                        className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                        title="Delete this audit log"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {expanded && hasDetails && (
                    <div className="mt-3.5 ml-13 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>Change Log Comparison</span>
                        {log.reason && (
                          <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                            Reason: {log.reason}
                          </span>
                        )}
                      </div>
                      {log.oldData && log.newData ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500 text-left">
                                <th className="py-1 px-2 font-medium">Field</th>
                                <th className="py-1 px-2 font-medium text-slate-600">Before (Old)</th>
                                <th className="py-1 px-2 font-medium text-slate-600">After (New)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {getComparisonKeys(log.oldData, log.newData).map((k) => {
                                const oldVal = log.oldData?.[k];
                                const newVal = log.newData?.[k];
                                const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
                                return (
                                  <tr key={k} className={changed ? "bg-amber-50/60" : ""}>
                                    <td className="py-1.5 px-2 font-mono font-medium text-slate-700 capitalize">
                                      {k.replace(/([A-Z])/g, " $1")}
                                    </td>
                                    <td className="py-1.5 px-2 text-slate-500 line-through">{formatValue(oldVal)}</td>
                                    <td className={`py-1.5 px-2 font-semibold ${changed ? "text-primary" : "text-slate-700"}`}>
                                      {formatValue(newVal)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500 text-left">
                                <th className="py-1 px-2 font-medium">Field</th>
                                <th className="py-1 px-2 font-medium text-slate-600">Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {Object.entries(log.newData || log.oldData || {}).map(([k, v]) => (
                                <tr key={k}>
                                  <td className="py-1.5 px-2 font-mono font-medium text-slate-700 capitalize">
                                    {k.replace(/([A-Z])/g, " $1")}
                                  </td>
                                  <td className="py-1.5 px-2 font-medium text-slate-800">{formatValue(v)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!loading && logs.length > 0 && (
          <Pagination page={page} pageSize={pageSize} total={logs.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemName="logs" />
        )}
      </div>
    </div>
  );
}