import { useEffect, useRef, useState } from "react";
import {
  Users,
  UserRound,
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BriefcaseBusiness,
  TrendingUp,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import axiosInstance from "../../config/ApiClient";
import { useAppSelector } from "../../lib/hooks/redux";
import MyCheckInCard from "../../components/common/MyCheckInCard";

// dashboard data ko type - API bata aune format
interface IDashboardSummary {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeave: number;
  lateToday: number;
  currentlyWorking: number;
}

interface IAttendanceRecord {
  _id: string;
  employee?: {
    name: string;
    employeeId: string;
    role?: string;
    department?: { name: string } | null;
    designation?: { name: string } | null;
  } | null;
  branch?: { name: string } | null;
  date: string;
  checkIn?: { time?: string; distance?: number } | null;
  checkOut?: { time?: string; distance?: number } | null;
  status: string;
  workingMinutes?: number;
}

interface IFilterOption {
  _id: string;
  name: string;
}

interface IRate {
  workingDays: number;
  presentDays: number;
  late: number;
  absent: number;
  leave: number;
  rate: number;
}

// /reports/dashboard response envelope (ApiClient le body unwrap garxa)
interface IDashboardBody {
  data?: {
    summary?: IDashboardSummary;
    attendanceList?: IAttendanceRecord[];
  };
  meta?: {
    pagination?: { total?: number };
  } | null;
}

// yo page le dashboard ma sabai stats dekhauxa
export default function Dashboard() {
  const { authUser } = useAppSelector((state) => state.auth);
  // manager / hr_admin le yahi bata aafai check-in/out garna pauxan -
  // uniharuko record Attendance/Reports list ma HR + super admin lai dekhincha
  const showMyCheckIn = authUser?.role === "manager" || authUser?.role === "hr_admin";
  const [summary, setSummary] = useState<IDashboardSummary>({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    onLeave: 0,
    lateToday: 0,
    currentlyWorking: 0,
  });
  const [attendanceList, setAttendanceList] = useState<IAttendanceRecord[]>([]);
  // server-side total (pagination meta bata) - "View all N records" ko lagi
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  // hr_admin / manager ko aafnai "This Month" attendance rate (employee jastai)
  const [myRate, setMyRate] = useState<IRate | null>(null);

  // filters - branch -> department -> designation cascade
  const [filters, setFilters] = useState({
    branchId: "",
    departmentId: "",
    designationId: "",
  });
  const [filtering, setFiltering] = useState(false);

  // dropdown options haru (branch pheri departments, department pheri designations)
  const [departments, setDepartments] = useState<IFilterOption[]>([]);
  const [designations, setDesignations] = useState<IFilterOption[]>([]);
  const [branches, setBranches] = useState<IFilterOption[]>([]);

  // time anusar greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  // logged-in user ko full name lincha (email prefix hoina)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axiosInstance.get("/auth/me");
        if (!active) return;
        const data = res.data as { username?: string | null; role?: string; employee?: { name?: string } | null };
        const roleLabels: Record<string, string> = {
          super_admin: "Super Admin",
          hr_admin: "HR / Admin",
          manager: "Manager",
          employee: "Employee",
        };
        // register process ma set gareko username lai priority dinxa
        setUserName(
          data.username ||
          data.employee?.name ||
          (data.role ? roleLabels[data.role] : "") ||
          "",
        );
      } catch {
        /* silently fail - greeting matra ho */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // hr_admin / manager ko aafnai monthly rate - employee dashboard jastai
  useEffect(() => {
    if (!showMyCheckIn) return;
    let active = true;
    (async () => {
      try {
        const res = await axiosInstance.get("/attendance/rate");
        if (active) setMyRate((res.data as IRate) ?? null);
      } catch {
        /* silently fail - rate optional */
      }
    })();
    return () => {
      active = false;
    };
  }, [showMyCheckIn]);

  // branches eui choti load garne (departments/designations branch anusar cascade huncha)
  useEffect(() => {
    (async () => {
      try {
        const branchRes = await axiosInstance.get("/branches");
        setBranches((branchRes.data as IFilterOption[]) ?? []);
      } catch {
        /* silently fail - filter options matra ho */
      }
    })();
  }, []);

  // branch select huda tyo branch ko departments matra dekhauxa
  useEffect(() => {
    if (!filters.branchId) return;
    let active = true;
    (async () => {
      try {
        const deptRes = await axiosInstance.get("/departments", {
          params: { branch: filters.branchId },
        });
        if (!active) return;
        setDepartments((deptRes.data as IFilterOption[]) ?? []);
      } catch {
        /* silently fail */
      }
    })();
    return () => {
      active = false;
    };
  }, [filters.branchId]);

  // department select huda branch + department ko designations matra dekhauxa
  useEffect(() => {
    if (!filters.branchId || !filters.departmentId) return;
    let active = true;
    (async () => {
      try {
        const desigRes = await axiosInstance.get("/designations", {
          params: { branch: filters.branchId, department: filters.departmentId },
        });
        if (!active) return;
        setDesignations((desigRes.data as IFilterOption[]) ?? []);
      } catch {
        /* silently fail */
      }
    })();
    return () => {
      active = false;
    };
  }, [filters.branchId, filters.departmentId]);

  // mount ma EK choti: summary + first-page list sangai (duplicate /reports/dashboard hataiyo)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response: IDashboardBody = await axiosInstance.get("/reports/dashboard", {
          params: { limit: 10 },
        });
        if (!active) return;
        const data = response.data;
        if (data?.summary) {
          setSummary(data.summary);
        }
        if (data?.attendanceList) {
          setAttendanceList(data.attendanceList);
        }
        const total = response?.meta?.pagination?.total;
        if (typeof total === "number") {
          setTotalRecords(total);
        } else if (Array.isArray(data?.attendanceList)) {
          setTotalRecords(data.attendanceList.length);
        }
      } catch {
        // silently fail
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // filter apply bhayo ki hudaina check garne
  const hasActiveFilters = !!(filters.branchId || filters.departmentId || filters.designationId);

  // mount skip garne ref - mount ko list mount-effect le nai lyaisakyo
  const isFirstFilterRun = useRef(true);

  // filter change huda list matra refetch, summary sadhai global
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    let active = true;

    const fetchFiltered = async () => {
      setFiltering(true);
      try {
        const params: Record<string, string | number> = { listOnly: 1, limit: 10 };
        if (filters.branchId) params.branchId = filters.branchId;
        if (filters.departmentId) params.departmentId = filters.departmentId;
        if (filters.designationId) params.designationId = filters.designationId;

        const response: IDashboardBody = await axiosInstance.get("/reports/dashboard", { params });
        if (!active) return;
        setAttendanceList(response.data?.attendanceList ?? []);
        const total = response?.meta?.pagination?.total;
        if (typeof total === "number") {
          setTotalRecords(total);
        } else if (Array.isArray(response.data?.attendanceList)) {
          setTotalRecords(response.data.attendanceList.length);
        }
      } catch {
        if (active) {
          setAttendanceList([]);
          setTotalRecords(0);
        }
      } finally {
        if (active) setFiltering(false);
      }
    };

    fetchFiltered();
    return () => {
      active = false;
    };
  }, [filters.branchId, filters.departmentId, filters.designationId]);

  const setFilter = (key: keyof typeof filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  // quick actions - brand: primary for Employees, secondary accents for others
  const quickActions = [
    { label: "Users", icon: Users, path: "/admin/users", color: "bg-primary", shadow: "shadow-primary/20" },
    { label: "Employees", icon: UserRound, path: "/admin/employees", color: "bg-primary", shadow: "shadow-primary/20" },
    { label: "Departments", icon: BriefcaseBusiness, path: "/admin/departments", color: "bg-primary", shadow: "shadow-primary/20" },
    { label: "Reports", icon: Clock, path: "/admin/reports", color: "bg-primary", shadow: "shadow-primary/20" },
  ];

  // stat cards - first two use brand, others semantic
  const statCards = [
    {
      label: "Total Employees",
      value: summary.totalEmployees,
      icon: Users,
      color: "text-primary",
      bg: "bg-secondary",
      border: "border-border",
    },
    {
      label: "Present Today",
      value: summary.presentToday,
      icon: CheckCircle2,
      color: "text-primary",
      bg: "bg-secondary",
      border: "border-border",
    },
    {
      label: "Absent Today",
      value: summary.absentToday,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100",
    },
    {
      label: "On Leave",
      value: summary.onLeave,
      icon: CalendarCheck,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      label: "Late Today",
      value: summary.lateToday,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-100",
    },
    {
      label: "Currently Working",
      value: summary.currentlyWorking,
      icon: UserRound,
      color: "text-primary",
      bg: "bg-secondary-muted",
      border: "border-border",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Page header - time anusar greeting + user ko name */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {greeting}{userName ? `, ${userName}` : ""}!
        </h1>
        <p className="mt-1 text-slate-500">Welcome back! Here's your system overview.</p>
      </div>

      {/* My check-in - manager / hr_admin ko lagi */}
      {showMyCheckIn && <MyCheckInCard />}

      {/* This Month - manager / hr_admin ko aafnai attendance rate (employee jastai) */}
      {showMyCheckIn && myRate && (
        <div className="rounded-2xl bg-white border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" /> This Month
            </p>
            <p className="text-lg font-bold text-primary">{myRate.rate}%</p>
          </div>
          <div className="h-2.5 rounded-full bg-secondary-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, myRate.rate)}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4 text-center">
            <div className="rounded-xl bg-secondary py-2"><p className="text-base font-bold text-primary">{myRate.presentDays}</p><p className="text-[10px] text-primary/70">Present</p></div>
            <div className="rounded-xl bg-amber-50 py-2"><p className="text-base font-bold text-amber-600">{myRate.late}</p><p className="text-[10px] text-amber-600/70">Late</p></div>
            <div className="rounded-xl bg-secondary py-2"><p className="text-base font-bold text-primary">{myRate.leave}</p><p className="text-[10px] text-primary/70">Leave</p></div>
            <div className="rounded-xl bg-red-50 py-2"><p className="text-base font-bold text-red-500">{myRate.absent}</p><p className="text-[10px] text-red-500/70">Absent</p></div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-2xl bg-white border ${stat.border} p-5 hover:shadow-md hover:border-primary/20 transition-all`}>
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <Icon size={20} className={stat.color} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <NavLink
                key={action.path}
                to={action.path}
                className={`flex items-center gap-4 p-5 rounded-2xl ${action.color} text-white shadow-lg ${action.shadow} hover:bg-primary-hover hover:scale-[1.02] transition-all`}
              >
                <Icon size={28} />
                <div>
                  <p className="font-bold">{action.label}</p>
                  <p className="text-xs text-white/80">Manage {action.label.toLowerCase()}</p>
                </div>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Attendance Table + Filters */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/50">
          <h2 className="text-lg font-bold text-slate-800">Today's Attendance</h2>
          <p className="text-sm text-slate-500 mt-1">{totalRecords} records</p>

          {/* Filters - branch -> department -> designation cascade */}
          <div className="mt-4 flex flex-col sm:flex-row flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Branch</label>
              <select
                value={filters.branchId}
                onChange={(e) => {
                  setFilters((prev) => ({
                    ...prev,
                    branchId: e.target.value,
                    departmentId: "",
                    designationId: "",
                  }));
                  setDepartments([]);
                  setDesignations([]);
                }}
                className="rounded-xl border border-border px-3 py-2 text-sm bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 min-w-[180px]"
              >
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>{branch.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Department</label>
              <select
                value={filters.departmentId}
                disabled={!filters.branchId}
                onChange={(e) => {
                  setFilters((prev) => ({
                    ...prev,
                    departmentId: e.target.value,
                    designationId: "",
                  }));
                  setDesignations([]);
                }}
                className="rounded-xl border border-border px-3 py-2 text-sm bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 min-w-[180px] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!filters.branchId
                    ? "Select a branch first"
                    : departments.length === 0
                      ? "No departments in this branch"
                      : "Select Department"}
                </option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Designation</label>
              <select
                value={filters.designationId}
                disabled={!filters.departmentId}
                onChange={(e) => setFilter("designationId", e.target.value)}
                className="rounded-xl border border-border px-3 py-2 text-sm bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 min-w-[180px] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!filters.departmentId
                    ? "Select a department first"
                    : designations.length === 0
                      ? "No designations in this department"
                      : "Select Designation"}
                </option>
                {designations.map((desig) => (
                  <option key={desig._id} value={desig._id}>{desig.name}</option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setFilters({ branchId: "", departmentId: "", designationId: "" });
                  setDepartments([]);
                  setDesignations([]);
                }}
                className="rounded-xl border border-border px-4 py-2 text-sm text-slate-600 hover:bg-secondary/30 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filtering ? (
          <div className="py-16 flex items-center justify-center text-slate-500 text-sm">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
            Filtering...
          </div>
        ) : attendanceList.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">No attendance records found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Employee</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Branch</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Department</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Designation</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Role</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Check In</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Check Out</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceList.map((rec) => (
                    <tr key={rec._id} className="border-b border-slate-50 hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-secondary text-primary flex items-center justify-center font-bold text-xs">
                            {rec.employee?.name?.charAt(0)?.toUpperCase() || "N"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{rec.employee?.name || "Unknown"}</p>
                            <p className="text-[10px] text-slate-500">{rec.employee?.employeeId || ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600">{rec.branch?.name || "-"}</td>
                      <td className="px-6 py-3 text-sm text-slate-600">{rec.employee?.department?.name || "-"}</td>
                      <td className="px-6 py-3 text-sm text-slate-600">{rec.employee?.designation?.name || "-"}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                          rec.employee?.role === "super_admin" ? "bg-violet-100 text-violet-700" :
                          rec.employee?.role === "hr_admin" ? "bg-blue-100 text-blue-700" :
                          rec.employee?.role === "manager" ? "bg-indigo-100 text-indigo-700" :
                          rec.employee?.role === "platform_admin" ? "bg-slate-800 text-white" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {rec.employee?.role
                            ? rec.employee.role === "hr_admin"
                              ? "HR / Admin"
                              : rec.employee.role === "super_admin"
                                ? "Super Admin"
                                : rec.employee.role === "platform_admin"
                                  ? "Platform Admin"
                                  : rec.employee.role === "manager"
                                    ? "Manager"
                                    : "Employee"
                            : "Employee"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600">
                        {rec.checkIn?.time ? new Date(rec.checkIn.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600">
                        {rec.checkOut?.time ? new Date(rec.checkOut.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                          rec.status === "present" ? "bg-secondary text-primary" :
                          rec.status === "late" ? "bg-amber-100 text-amber-700" :
                          rec.status === "absent" ? "bg-red-100 text-red-700" :
                          rec.status === "half_day" ? "bg-orange-100 text-orange-700" :
                          rec.status === "leave" ? "bg-secondary text-primary" :
                          rec.status === "holiday" ? "bg-pink-100 text-pink-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600">
                        {rec.workingMinutes ? `${(rec.workingMinutes / 60).toFixed(1)}h` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalRecords > 10 && (
              <div className="p-4 border-t border-border/50 text-center">
                <NavLink to="/admin/attendance" className="text-sm text-primary hover:underline font-medium">
                  View all {totalRecords} records
                </NavLink>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
