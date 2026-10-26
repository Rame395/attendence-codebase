import { useEffect, useState } from "react";
import { CalendarCheck, Clock, MapPin, User, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import { formatDate, formatTime as fmtTime, toLocalDateInput } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import { useAppSelector } from "../../lib/hooks/redux";
import BSCalendarInput from "../../components/ui/BSCalendarInput";
import Pagination from "../../components/common/Pagination";

// attendance record ko type
interface IAttendance {
  _id: string;
  employee?: { _id: string; name: string; employeeId: string; email?: string } | null;
  branch?: { name: string } | null;
  date: string;
  checkIn?: { time: string; distance?: number; accuracy?: number } | null;
  checkOut?: { time: string; distance?: number; accuracy?: number } | null;
  status: string;
  workingMinutes?: number;
}

interface IOption {
  _id: string;
  name: string;
}

const STATUS_OPTIONS = [
  "present",
  "absent",
  "late",
  "half_day",
  "leave",
  "holiday",
];

// mark/edit modal ko form data
interface IMarkForm {
  attendanceId: string | null; // null bhaye create, natra edit
  employee: string;
  date: string;
  checkInTime: string; // "HH:mm"
  checkOutTime: string; // "HH:mm"
  status: string;
}

// ISO time bata local "HH:mm" nikalne (edit modal ma prefill garna)
const toLocalHHmm = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// yo page le sabai attendance records dekhauxa + admin le manually mark/edit garna milcha
export default function Attendance() {
  const calPref = useCalendarPreference();
  const { authUser } = useAppSelector((state) => state.auth);
  // mark/edit manually only super_admin/hr_admin le garna pauxa (manager view-only)
  const canManageAttendance = authUser?.role === "super_admin" || authUser?.role === "hr_admin";
  const [records, setRecords] = useState<IAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const todayStr = toLocalDateInput(new Date());
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedRecords = records.slice(start, start + pageSize);

  // filters - cascading: branch → department → designation
  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // dropdown options
  const [employees, setEmployees] = useState<IOption[]>([]);
  const [branches, setBranches] = useState<IOption[]>([]);
  const [departments, setDepartments] = useState<IOption[]>([]);
  const [designations, setDesignations] = useState<IOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  // mark/edit modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<IMarkForm>({
    attendanceId: null,
    employee: "",
    date: todayStr,
    checkInTime: "",
    checkOutTime: "",
    status: "",
  });

  // mark modal cascading selection (branch → dept → designation → employee)
  const [modalBranch, setModalBranch] = useState("");
  const [modalDepartment, setModalDepartment] = useState("");
  const [modalDesignation, setModalDesignation] = useState("");
  const [modalDepartments, setModalDepartments] = useState<IOption[]>([]);
  const [modalDesignations, setModalDesignations] = useState<IOption[]>([]);
  const [modalEmployees, setModalEmployees] = useState<IOption[]>([]);
  const [modalEmployeesLoading, setModalEmployeesLoading] = useState(false);

  // branches fetch on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const branchRes = await axiosInstance.get("/branches");
        if (active) setBranches((branchRes.data as any[]) ?? []);
      } catch { /* silently fail */ }
    })();
    return () => { active = false; };
  }, []);

  // departments cascade on branch change
  useEffect(() => {
    if (!branchFilter) { setDepartments([]); return; }
    let active = true;
    (async () => {
      try {
        const res = await axiosInstance.get("/departments", { params: { branch: branchFilter } });
        if (active) setDepartments((res.data as any[]) ?? []);
      } catch { /* silently fail */ }
    })();
    return () => { active = false; };
  }, [branchFilter]);

  // designations cascade on branch + department change
  useEffect(() => {
    if (!branchFilter) { setDesignations([]); return; }
    let active = true;
    (async () => {
      try {
        const params: Record<string, string> = { branch: branchFilter };
        if (departmentFilter) params.department = departmentFilter;
        const res = await axiosInstance.get("/designations", { params });
        if (active) setDesignations((res.data as any[]) ?? []);
      } catch { /* silently fail */ }
    })();
    return () => { active = false; };
  }, [branchFilter, departmentFilter]);

  // employees cascade on branch + department + designation change
  useEffect(() => {
    if (!branchFilter) { setEmployees([]); return; }
    let active = true;
    (async () => {
      try {
        setEmployeesLoading(true);
        // includeStaff: manager/HR ko check-in record pani filter garna milos
        const params: Record<string, string> = { branch: branchFilter, includeStaff: "true" };
        if (departmentFilter) params.department = departmentFilter;
        if (designationFilter) params.designation = designationFilter;
        const res = await axiosInstance.get("/employees", { params });
        if (active) setEmployees((res.data as any[]) ?? []);
      } catch { /* silently fail */ } finally {
        if (active) setEmployeesLoading(false);
      }
    })();
    return () => { active = false; };
  }, [branchFilter, departmentFilter, designationFilter]);

  const handleBranchChange = (id: string) => {
    setBranchFilter(id);
    setDepartmentFilter("");
    setDesignationFilter("");
    setEmployeeFilter("");
  };

  const handleDepartmentChange = (id: string) => {
    setDepartmentFilter(id);
    setDesignationFilter("");
    setEmployeeFilter("");
  };

  const handleDesignationChange = (id: string) => {
    setDesignationFilter(id);
    setEmployeeFilter("");
  };

  const handleEmployeeChange = (id: string) => {
    setEmployeeFilter(id);
  };

  // mark modal: departments cascade on branch change
  useEffect(() => {
    if (!modalBranch) { setModalDepartments([]); return; }
    let active = true;
    (async () => {
      try {
        const res = await axiosInstance.get("/departments", { params: { branch: modalBranch } });
        if (active) setModalDepartments((res.data as any[]) ?? []);
      } catch { /* silently fail */ }
    })();
    return () => { active = false; };
  }, [modalBranch]);

  // modal designations cascade on modal branch + department change
  useEffect(() => {
    if (!modalBranch) { setModalDesignations([]); return; }
    let active = true;
    (async () => {
      try {
        const params: Record<string, string> = { branch: modalBranch };
        if (modalDepartment) params.department = modalDepartment;
        const res = await axiosInstance.get("/designations", { params });
        if (active) setModalDesignations((res.data as any[]) ?? []);
      } catch { /* silently fail */ }
    })();
    return () => { active = false; };
  }, [modalBranch, modalDepartment]);

  // modal employees cascade on modal branch + department + designation change
  useEffect(() => {
    if (!modalBranch) { setModalEmployees([]); return; }
    let active = true;
    (async () => {
      try {
        setModalEmployeesLoading(true);
        // includeStaff: manager/HR ko lagi pani manual mark garna milos
        const params: Record<string, string> = { branch: modalBranch, includeStaff: "true" };
        if (modalDepartment) params.department = modalDepartment;
        if (modalDesignation) params.designation = modalDesignation;
        const res = await axiosInstance.get("/employees", { params });
        if (active) setModalEmployees((res.data as any[]) ?? []);
      } catch { /* silently fail */ } finally {
        if (active) setModalEmployeesLoading(false);
      }
    })();
    return () => { active = false; };
  }, [modalBranch, modalDepartment, modalDesignation]);

  const handleModalBranchChange = (id: string) => {
    setModalBranch(id);
    setModalDepartment("");
    setModalDesignation("");
    setForm((f) => ({ ...f, employee: "" }));
  };

  const handleModalDepartmentChange = (id: string) => {
    setModalDepartment(id);
    setModalDesignation("");
    setForm((f) => ({ ...f, employee: "" }));
  };

  const handleModalDesignationChange = (id: string) => {
    setModalDesignation(id);
    setForm((f) => ({ ...f, employee: "" }));
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const params: Record<string, string> = { date: dateFilter };
        if (employeeFilter) params.employeeId = employeeFilter;
        if (departmentFilter) params.departmentId = departmentFilter;
        if (branchFilter) params.branchId = branchFilter;
        if (designationFilter) params.designationId = designationFilter;
        if (statusFilter) params.status = statusFilter;

        const response = await axiosInstance.get("/attendance", { params });
        setRecords(response.data || []);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Failed to fetch attendance");
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [dateFilter, employeeFilter, departmentFilter, branchFilter, designationFilter, statusFilter]);

  // naya mark modal kholne
  const openMarkModal = () => {
    setForm({
      attendanceId: null,
      employee: "",
      date: dateFilter || todayStr,
      checkInTime: "",
      checkOutTime: "",
      status: "",
    });
    setModalBranch("");
    setModalDepartment("");
    setModalDesignation("");
    setModalDepartments([]);
    setModalDesignations([]);
    setModalEmployees([]);
    setShowModal(true);
  };

  // edit modal kholne - record bata prefill garne
  const openEditModal = (rec: IAttendance) => {
    setForm({
      attendanceId: rec._id,
      employee: rec.employee?._id ?? "",
      date: toLocalDateInput(new Date(rec.date)),
      checkInTime: toLocalHHmm(rec.checkIn?.time),
      checkOutTime: toLocalHHmm(rec.checkOut?.time),
      status: rec.status || "",
    });
    setShowModal(true);
  };

  // save (create ya update)
  const handleSave = async () => {
    try {
      if (form.attendanceId) {
        // edit: status + times optional, anchor on existing record
        setSaving(true);
        await axiosInstance.put(`/attendance/${form.attendanceId}`, {
          checkInTime: form.checkInTime || undefined,
          checkOutTime: form.checkOutTime || undefined,
          ...(form.status ? { status: form.status } : {}),
        });
        toast.success("Attendance updated successfully");
      } else {
        // create (mark): sabai field required
        if (!modalBranch) {
          toast.error("Please select a branch");
          return;
        }
        if (!modalDepartment) {
          toast.error("Please select a department");
          return;
        }
        if (!modalDesignation) {
          toast.error("Please select a designation");
          return;
        }
        if (!form.employee) {
          toast.error("Please select an employee");
          return;
        }
        if (!form.date) {
          toast.error("Please select a date");
          return;
        }
        if (!form.checkInTime) {
          toast.error("Please enter check-in time");
          return;
        }
        if (!form.checkOutTime) {
          toast.error("Please enter check-out time");
          return;
        }
        if (!form.status) {
          toast.error("Please select a status");
          return;
        }

        setSaving(true);
        await axiosInstance.post("/attendance/mark", {
          employee: form.employee,
          date: form.date,
          checkInTime: form.checkInTime || undefined,
          checkOutTime: form.checkOutTime || undefined,
          ...(form.status ? { status: form.status } : {}),
        });
        toast.success("Attendance marked successfully");
      }

      setShowModal(false);

      // list manually refetch garne (date filter state le trigger gardaina)
      const params: Record<string, string> = { date: dateFilter };
      if (employeeFilter) params.employeeId = employeeFilter;
      if (departmentFilter) params.departmentId = departmentFilter;
      if (branchFilter) params.branchId = branchFilter;
      if (designationFilter) params.designationId = designationFilter;
      if (statusFilter) params.status = statusFilter;

      const response = await axiosInstance.get("/attendance", { params });
      setRecords(response.data || []);
    } catch (error: any) {
      toast.error(
        error?.data?.message ||
        error?.data?.error ||
        error?.response?.data?.message ||
        "Failed to save attendance",
      );
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (dateStr?: string) => fmtTime(dateStr);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      present: "bg-secondary text-primary",
      absent: "bg-red-100 text-red-700",
      late: "bg-amber-100 text-amber-700",
      half_day: "bg-orange-100 text-orange-700",
      leave: "bg-secondary text-primary",
      holiday: "bg-pink-100 text-pink-700",
      weekend: "bg-slate-100 text-slate-700",
    };
    return map[status] || "bg-slate-100 text-slate-700";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
          <p className="mt-1 text-slate-500">Daily attendance records and tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <BSCalendarInput
            value={new Date(dateFilter)}
            onChange={(d) => { if (d) setDateFilter(toLocalDateInput(d)); }}
            label=""
          />
          {canManageAttendance && (
            <button
              onClick={openMarkModal}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              <Plus size={16} />
              Mark Attendance
            </button>
          )}
        </div>
      </div>

      {/* Filters row - cascading: Branch → Department → Designation → Employee */}
      <div className="bg-white rounded-2xl border border-border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <span className="block text-[11px] font-medium text-slate-500 mb-1">Branch</span>
          <select
            value={branchFilter}
            onChange={(e) => handleBranchChange(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary"
          >
            <option value="">All Branches</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>{branch.name}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-slate-500 mb-1">Department</span>
          <select
            value={departmentFilter}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            disabled={!branchFilter}
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">{branchFilter ? "All Departments" : "Select branch first"}</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>{dept.name}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-slate-500 mb-1">Designation</span>
          <select
            value={designationFilter}
            onChange={(e) => handleDesignationChange(e.target.value)}
            disabled={!branchFilter}
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">{branchFilter ? "All Designations" : "Select branch first"}</option>
            {designations.map((des) => (
              <option key={des._id} value={des._id}>{des.name}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-slate-500 mb-1">Employee</span>
          <select
            value={employeeFilter}
            onChange={(e) => handleEmployeeChange(e.target.value)}
            disabled={!branchFilter}
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">{!branchFilter ? "Select branch first" : employeesLoading ? "Loading..." : departmentFilter ? "All of dept" : "All Employees"}</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="block text-[11px] font-medium text-slate-500 mb-1">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm capitalize bg-white outline-none focus:border-primary"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Attendance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-primary p-5 text-white shadow-lg shadow-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <CalendarCheck size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold">{records.filter((r) => r.status === "present" || r.status === "late").length}</p>
              <p className="text-xs text-secondary">Present</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-r from-red-500 to-red-600 p-5 text-white shadow-lg shadow-red-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <User size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold">{records.filter((r) => r.status === "absent").length}</p>
              <p className="text-xs text-red-100">Absent</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 p-5 text-white shadow-lg shadow-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold">{records.filter((r) => r.status === "late").length}</p>
              <p className="text-xs text-amber-100">Late</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading attendance...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No attendance records found for this date</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Employee</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Check In</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Check Out</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Status</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Location</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map((rec) => (
                  <tr key={rec._id} className="border-b border-slate-50 hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">
                          {rec.employee?.name?.charAt(0)?.toUpperCase() || "N"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{rec.employee?.name || "Unknown"}</p>
                          <p className="text-[11px] text-slate-500">{rec.employee?.employeeId || "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{formatDate(new Date(rec.date), calPref)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Clock size={14} className="text-primary" />
                        {formatTime(rec.checkIn?.time)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Clock size={14} className="text-red-500" />
                        {formatTime(rec.checkOut?.time)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(rec.status)}`}>
                        {rec.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {rec.checkIn?.distance != null ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <MapPin size={14} />
                          <span className="text-[11px]">{rec.checkIn.distance}m from office</span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Manual</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {canManageAttendance ? (
                        <button
                          onClick={() => openEditModal(rec)}
                          className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-secondary transition-colors"
                          title="Edit attendance"
                        >
                          <Pencil size={15} />
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && records.length > 0 && (
          <Pagination page={page} pageSize={pageSize} total={records.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemName="records" />
        )}
      </div>

      {/* Mark/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900">
              {form.attendanceId ? "Edit Attendance" : "Mark Attendance"}
            </h2>

            {!form.attendanceId && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-slate-500">Select employee</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Branch *</label>
                  <select
                    value={modalBranch}
                    onChange={(e) => handleModalBranchChange(e.target.value)}
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary"
                  >
                    <option value="">Select branch</option>
                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
                  <select
                    value={modalDepartment}
                    onChange={(e) => handleModalDepartmentChange(e.target.value)}
                    disabled={!modalBranch}
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">{modalBranch ? "Select department" : "Select branch first"}</option>
                    {modalDepartments.map((dept) => (
                      <option key={dept._id} value={dept._id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Designation *</label>
                  <select
                    value={modalDesignation}
                    onChange={(e) => handleModalDesignationChange(e.target.value)}
                    disabled={!modalBranch}
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">{modalBranch ? "Select designation" : "Select branch first"}</option>
                    {modalDesignations.map((des) => (
                      <option key={des._id} value={des._id}>{des.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
                  <select
                    value={form.employee}
                    onChange={(e) => setForm({ ...form, employee: e.target.value })}
                    disabled={!modalBranch}
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">{!modalBranch ? "Select branch first" : modalEmployeesLoading ? "Loading..." : "Select employee"}</option>
                    {modalEmployees.map((emp) => (
                      <option key={emp._id} value={emp._id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {!form.attendanceId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                <BSCalendarInput
                  value={new Date(form.date)}
                  onChange={(d) => { if (d) setForm({ ...form, date: toLocalDateInput(d) }); }}
                  placeholder="Select date"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Check In Time</label>
              <input
                type="time"
                value={form.checkInTime}
                onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Check Out Time</label>
              <input
                type="time"
                value={form.checkOutTime}
                onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm capitalize bg-white outline-none focus:border-primary"
              >
                <option value="">Select status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-slate-600 hover:bg-secondary/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : form.attendanceId ? "Update" : "Mark"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
