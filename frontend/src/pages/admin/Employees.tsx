import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  Eye,
  X,
  BriefcaseBusiness,
  MapPin,
  Phone,
  Mail,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import GenderSelect from "../../components/common/GenderSelect";
import EntityPicker from "../../components/common/EntityPicker";
import { toastApiErrors } from "../../lib/apiErrors";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Avatar from "../../components/common/Avatar";
import ProfileImageUpload from "../../components/common/ProfileImageUpload";
import type { IProfileImage } from "../../lib/profileImage";
import { formatDate, toLocalDateInput, parseLocalDate } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import { useModalAccessibility } from "../../lib/hooks/useModalAccessibility";
import { useAppSelector } from "../../lib/hooks/redux";
import BSCalendarInput from "../../components/ui/BSCalendarInput";

// employee photo upload helper - create/update pachhi call garne
async function uploadEmployeeImage(employeeId: string, f: File) {
  const fd = new FormData();
  fd.append("profileImage", f);
  await axiosInstance.post(`/employees/${employeeId}/profile-image`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

// employee data ko type
interface IEmployeeData {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  joiningDate?: string;
  status?: string;
  profileImage?: IProfileImage | null;
  department?: { _id: string; name: string; code: string } | null;
  designation?: { _id: string; name: string } | null;
  branch?: { _id: string; name: string; code: string } | null;
  manager?: { _id: string; name: string } | null;
  gender?: "male" | "female" | "other" | null;
}

// dropdown option ko type
interface IOption {
  _id: string;
  name: string;
}

// employees list - role-based CRUD + branch-scope enforced
export default function Employees() {
  const { authUser } = useAppSelector((state) => state.auth);
  const canManageEmployees = authUser?.role === "super_admin" || authUser?.role === "hr_admin";
  // manager le pani employee edit garna pauxa (branch/department locked)
  const canEditEmployees = canManageEmployees || authUser?.role === "manager";
  // aafnai branch scope (hr_admin/manager + employee record ma branch cha bhane)
  const [ownBranch, setOwnBranch] = useState<IOption | null>(null);
  const scopedBranchId =
    (authUser?.role === "hr_admin" || authUser?.role === "manager") && ownBranch
      ? ownBranch._id
      : null;
  const [employees, setEmployees] = useState<IEmployeeData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // cascade filters: branch → department
  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [branches, setBranches] = useState<IOption[]>([]);
  const [departments, setDepartments] = useState<IOption[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState<IEmployeeData | null>(null);
  const [viewEmployee, setViewEmployee] = useState<IEmployeeData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IEmployeeData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const draftStorageKey = `attendance_draft_employee_${authUser?.email || "default"}`;
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(`attendance_draft_employee_${authUser?.email || "default"}`));
    } catch {
      return false;
    }
  });

  const refreshDraftFlag = useCallback(() => {
    try {
      setHasSavedDraft(Boolean(localStorage.getItem(draftStorageKey)));
    } catch {
      setHasSavedDraft(false);
    }
  }, [draftStorageKey]);

  const ownerHasEmployeeProfile = !authUser?.email
    ? true
    : employees.some((emp) => emp.email.toLowerCase() === authUser.email!.toLowerCase());

  // search + cascade filter anusar filter (derived state - effect chahiyna)
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return employees.filter((emp) => {
      const matchesSearch =
        !q ||
        emp.name.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.phone?.toLowerCase().includes(q) ||
        emp.employeeId?.toLowerCase().includes(q) ||
        emp.department?.name?.toLowerCase().includes(q) ||
        emp.designation?.name?.toLowerCase().includes(q) ||
        emp.branch?.name?.toLowerCase().includes(q);

      const matchesBranch = !branchFilter || emp.branch?._id === branchFilter;
      const matchesDept = !departmentFilter || emp.department?._id === departmentFilter;

      return matchesSearch && matchesBranch && matchesDept;
    });
  }, [searchQuery, employees, branchFilter, departmentFilter]);

  // branches + aafnai branch scope fetch on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const branchRes = await axiosInstance.get("/branches");
        if (active) setBranches((branchRes.data as any[]) ?? []);
      } catch { /* silently fail */ }
      // /employees/me bata aafno branch - scoped hr/manager ko filter+form lock garna
      try {
        const me = (await axiosInstance.get("/employees/me")) as unknown as {
          data?: { employee?: { branch?: { _id: string; name: string } | null } | null };
        };
        const b = me?.data?.employee?.branch;
        if (active && b?._id) setOwnBranch({ _id: b._id, name: b.name });
      } catch { /* silently fail - unscoped (all branches) */ }
    })();
    return () => { active = false; };
  }, []);

  // scoped user ko branch filter sadhai aafnai branch ma lock
  useEffect(() => {
    if (scopedBranchId) {
      setBranchFilter(scopedBranchId);
      setDepartmentFilter("");
      setPage(1);
    }
  }, [scopedBranchId]);

  // departments cascade on branch change
  useEffect(() => {
    if (!branchFilter) { setDepartments([]); return; }
    let active = true;
    (async () => {
      try {
        setDeptLoading(true);
        const res = await axiosInstance.get("/departments", { params: { branch: branchFilter } });
        if (active) setDepartments((res.data as any[]) ?? []);
      } catch { /* silently fail */ } finally {
        if (active) setDeptLoading(false);
      }
    })();
    return () => { active = false; };
  }, [branchFilter]);

  const handleBranchFilter = (id: string) => {
    // scoped user le arko branch herna napaos
    if (scopedBranchId) return;
    setBranchFilter(id);
    setDepartmentFilter("");
    setPage(1);
  };

  const handleDepartmentFilter = (id: string) => {
    setDepartmentFilter(id);
    setPage(1);
  };

  // 5 wota dekhaune - page anusar slice, agadi arrow thichda feri pahila wala
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedEmployees = filteredEmployees.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
const response = (await axiosInstance.get("/employees")) as unknown as { data: IEmployeeData[] };
        if (!active) return;
        setEmployees(response.data || []);
      } catch (error) {
        if (active) toast.error((error as { message?: string })?.message || "Failed to fetch employees");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // list refresh garne (create/update/delete pachhi)
  const fetchEmployees = useCallback(async () => {
    try {
      const response = (await axiosInstance.get("/employees")) as unknown as { data: IEmployeeData[] };
      setEmployees(response.data || []);
    } catch (error) {
      toast.error((error as { message?: string })?.message || "Failed to fetch employees");
    }
  }, []);

  // employee delete garxa - sensitive
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await axiosInstance.delete(`/employees/${deleteTarget._id}`);
      toast.success("Employee deleted successfully");
      setDeleteTarget(null);
      fetchEmployees();
    } catch (error) {
      toast.error((error as { message?: string })?.message || "Failed to delete employee");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="mt-1 text-slate-500">
            {!canManageEmployees
              ? authUser?.role === "manager"
                ? "View and edit employee records"
                : "View employees and their records"
              : scopedBranchId
                ? "Manage employees of your branch"
                : "Manage your workforce and employee records"}
          </p>
        </div>
        {canManageEmployees && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
          >
            <Plus size={18} />
            Add Employee
            {hasSavedDraft && (
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-semibold">
                <Bookmark size={11} /> Draft
              </span>
            )}
          </button>
        )}
      </div>

      {/* Upfront warning if no branches exist yet */}
      {!loading && canManageEmployees && branches.length === 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">No branches added yet</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Employees require a Branch, Department, and Designation. Please create your Branch first from the Branches menu (or inside the Add Employee form).
            </p>
          </div>
        </div>
      )}

      {/* Search + filters in same row: search left, selects right */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-4 flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1">
          <label htmlFor="emp-search-input" className="block text-[11px] font-medium text-slate-500 mb-1">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="emp-search-input"
              type="text"
              value={searchQuery}
              placeholder="Search by name, email, ID, department, branch..."
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-secondary-muted/30 border border-border rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
        </div>
        <div className="w-full lg:w-52 shrink-0">
          <label htmlFor="emp-branch-filter" className="block text-[11px] font-medium text-slate-500 mb-1">Branch</label>
          <select
            id="emp-branch-filter"
            value={branchFilter}
            onChange={(e) => handleBranchFilter(e.target.value)}
            disabled={!!scopedBranchId}
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
          >
            {scopedBranchId ? (
              ownBranch && <option value={ownBranch._id}>{ownBranch.name}</option>
            ) : (
              <>
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>{branch.name}</option>
                ))}
              </>
            )}
          </select>
        </div>
        <div className="w-full lg:w-52 shrink-0">
          <label htmlFor="emp-dept-filter" className="block text-[11px] font-medium text-slate-500 mb-1">Department</label>
          <select
            id="emp-dept-filter"
            value={departmentFilter}
            onChange={(e) => handleDepartmentFilter(e.target.value)}
            disabled={!branchFilter}
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">{!branchFilter ? "Select branch first" : deptLoading ? "Loading..." : "All Departments"}</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>{dept.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees grid */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading employees...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No employees found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Employee</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Department</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Manager</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Branch</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Status</th>
                    <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedEmployees.map((emp) => (
                    <tr key={emp._id} className="border-b border-slate-50 hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
<div className="flex items-center gap-3">
                            <Avatar name={emp.name} imageUrl={emp.profileImage} size="md" gender={emp.gender} />
                            <div>
                            <p className="text-sm font-medium text-slate-800">{emp.name}</p>
                            <p className="text-[11px] text-slate-500">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700">{emp.department?.name || "-"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700">{emp.manager?.name || "-"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700">{emp.branch?.name || "-"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${emp.status === "active" ? "bg-secondary text-primary" : "bg-red-100 text-red-700"}`}>
                          {emp.status || "active"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setViewEmployee(emp)} aria-label={`View profile of ${emp.name}`} className="p-2 rounded-xl text-primary hover:bg-secondary transition-colors" title="View profile">
                            <Eye size={16} />
                          </button>
                          {canEditEmployees && (
                            <button type="button" onClick={() => setEditEmployee(emp)} aria-label={`Edit ${emp.name}`} className="p-2 rounded-xl text-amber-500 hover:bg-amber-50 transition-colors" title="Edit employee">
                              <Edit3 size={16} />
                            </button>
                          )}
                          {canManageEmployees && (
                            <button type="button" onClick={() => setDeleteTarget(emp)} aria-label={`Delete ${emp.name}`} className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors" title="Delete employee">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-slate-500">
                  Showing {pageStart + 1} - {Math.min(pageStart + pageSize, filteredEmployees.length)} of {filteredEmployees.length} employees
                </p>
                <label className="flex items-center gap-1.5 text-xs text-slate-400">
                  Show
                  <select
                    aria-label="Employees per page"
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="border border-border rounded-lg px-2 py-1 bg-white text-xs outline-none focus:border-primary"
                  >
                    {[5, 10, 15, 25, 50].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  per page
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-secondary/30 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    aria-label={`Page ${pg}`}
                    aria-current={pg === currentPage ? "page" : undefined}
                    onClick={() => setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      pg === currentPage
                        ? "bg-primary text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-secondary/30"
                    }`}
                  >
                    {pg}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-secondary/30 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Employee Modal - super_admin/hr_admin lai matra */}
      {canManageEmployees && showCreateModal && (
        <CreateEmployeeModal
          onClose={() => {
            setShowCreateModal(false);
            refreshDraftFlag();
          }}
          onCreated={() => {
            setShowCreateModal(false);
            refreshDraftFlag();
            fetchEmployees();
          }}
          lockedBranch={scopedBranchId && ownBranch ? ownBranch : null}
          draftStorageKey={draftStorageKey}
          authUser={authUser}
          ownerHasEmployeeProfile={ownerHasEmployeeProfile}
        />
      )}

      {/* Edit Employee Modal - super_admin/hr_admin/manager lai matra (manager locked branch/dept/manager) */}
      {canEditEmployees && editEmployee && (
        <EditEmployeeModal
          employee={editEmployee}
          onClose={() => setEditEmployee(null)}
          onUpdated={() => { setEditEmployee(null); fetchEmployees(); }}
          lockedBranch={scopedBranchId && ownBranch ? ownBranch : null}
          managerMode={authUser?.role === "manager"}
        />
      )}

      {/* View Employee Profile */}
      {viewEmployee && (
        <ViewEmployeeProfile
          employee={viewEmployee}
          onClose={() => setViewEmployee(null)}
        />
      )}

      {/* Delete Employee Confirmation - SENSITIVE - super_admin/hr_admin lai matra */}
      <ConfirmDialog
        open={canManageEmployees && !!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        variant="sensitive"
        title="Remove employee?"
        description="This will remove the employee and their login access. Their attendance, leave and correction history is kept and stays visible in reports (highlighted as Removed)."
        itemName={deleteTarget ? `${deleteTarget.name} (${deleteTarget.employeeId}) — ${deleteTarget.email}` : undefined}
        details={[
          "Employee will be hidden from lists and lose login access immediately",
          "Attendance, leave and correction history is preserved for reports",
          "Removed employees appear highlighted as Removed in downloaded reports",
          "Other employees managed by this employee will be unassigned",
          "You will need to recreate the employee to restore access",
        ]}
        confirmLabel="Delete employee"
        isLoading={isDeleting}
      />
    </div>
  );
}

// View employee profile modal
function ViewEmployeeProfile({ employee, onClose }: { employee: IEmployeeData; onClose: () => void }) {
  const calPref = useCalendarPreference();
  const modalRef = useModalAccessibility<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Employee Profile"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto outline-none"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-900">Employee Profile</h3>
          <button type="button" onClick={onClose} aria-label="Close employee profile" className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {/* Header - photo preview sadhai dekhincha */}
          <div className="flex items-center gap-4 mb-6">
            <Avatar name={employee.name} imageUrl={employee.profileImage} size="lg" gender={employee.gender} className="w-16 h-16 text-2xl" />
            <div>
              <h4 className="text-xl font-bold text-slate-900">{employee.name}</h4>
              <p className="text-sm text-slate-500">{employee.employeeId}</p>
              <span className={`inline-flex mt-1 px-3 py-0.5 rounded-full text-xs font-medium ${employee.status === "active" ? "bg-secondary text-primary" : "bg-red-100 text-red-700"}`}>
                {employee.status || "active"}
              </span>
            </div>
          </div>

          {/* Info rows */}
          <div className="space-y-4">
            <ProfileRow icon={Mail} label="Email" value={employee.email} />
            <ProfileRow icon={Phone} label="Phone" value={employee.phone || "-"} />
            <ProfileRow icon={BriefcaseBusiness} label="Department" value={employee.department?.name || "Not assigned"} />
            <ProfileRow icon={User} label="Designation" value={employee.designation?.name || "Not assigned"} />
            <ProfileRow icon={User} label="Manager" value={employee.manager?.name || "Not assigned"} />
            <ProfileRow icon={MapPin} label="Branch" value={employee.branch?.name || "Not assigned"} />
            <ProfileRow icon={User} label="Gender" value={employee.gender ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1) : "Not set"} />
            <ProfileRow icon={Calendar} label="Joining Date" value={employee.joiningDate ? formatDate(parseLocalDate(employee.joiningDate), calPref) : "-"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-secondary-muted/30">
      <Icon size={18} className="text-slate-400 shrink-0" />
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-800 font-medium">{value}</p>
      </div>
    </div>
  );
}

function hasEmployeeDraftContent(f: Record<string, string>): boolean {
  return Boolean(
    f.employeeId?.trim() ||
    f.name?.trim() ||
    f.email?.trim() ||
    f.phone?.trim() ||
    f.department?.trim() ||
    f.designation?.trim() ||
    f.joiningDate?.trim() ||
    f.gender?.trim() ||
    f.manager?.trim()
  );
}

// Create employee modal - POST /users le Employee + User create
function CreateEmployeeModal({
  onClose,
  onCreated,
  lockedBranch,
  draftStorageKey,
  authUser,
  ownerHasEmployeeProfile,
}: {
  onClose: () => void;
  onCreated: () => void;
  lockedBranch?: IOption | null;
  draftStorageKey: string;
  authUser?: { username?: string | null; email?: string | null; role?: string | null } | null;
  ownerHasEmployeeProfile?: boolean;
}) {
  const [draftRestored, setDraftRestored] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        return hasEmployeeDraftContent(parsed);
      }
    } catch {
      // ignore
    }
    return false;
  });

  const [form, setForm] = useState(() => {
    const base = {
      employeeId: "",
      name: "",
      email: "",
      phone: "",
      department: "",
      designation: "",
      branch: lockedBranch?._id || "",
      joiningDate: "",
      gender: "",
      manager: "",
      role: "employee",
    };
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<typeof base>;
        return {
          ...base,
          ...parsed,
          branch: lockedBranch?._id || parsed.branch || "",
        };
      }
    } catch {
      // ignore invalid draft
    }
    return base;
  });

  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ _id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ _id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  // photo - select garda instant preview, create pachhi upload huncha
  const [imageFile, setImageFile] = useState<File | null>(null);
  const modalRef = useModalAccessibility<HTMLDivElement>(onClose);

  // Auto-save form changes to localStorage draft
  useEffect(() => {
    try {
      if (hasEmployeeDraftContent(form)) {
        localStorage.setItem(draftStorageKey, JSON.stringify(form));
      }
    } catch {
      // ignore storage errors
    }
  }, [form, draftStorageKey]);

  const handleSaveAsDraft = () => {
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(form));
      toast.success("Employee details saved as draft! You can continue anytime.");
      onClose();
    } catch {
      toast.error("Failed to save draft");
    }
  };

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore
    }
    setDraftRestored(false);
    setForm({
      employeeId: "",
      name: "",
      email: "",
      phone: "",
      department: "",
      designation: "",
      branch: lockedBranch?._id || (branches.length === 1 ? branches[0]._id : ""),
      joiningDate: "",
      gender: "",
      manager: "",
      role: "employee",
    });
    setImageFile(null);
    toast.success("Draft cleared");
  };

  const handleFillOwnerDetails = () => {
    if (!authUser) return;
    setForm((f) => ({
      ...f,
      employeeId: f.employeeId || "EMP-001",
      name: authUser.username || f.name || "Owner",
      email: authUser.email || f.email,
      joiningDate: f.joiningDate || toLocalDateInput(new Date()),
    }));
    toast.success("Filled your account details! Select Branch, Department & Designation to complete.");
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [branchRes, empRes] = await Promise.all([
          axiosInstance.get("/branches"),
          axiosInstance.get("/employees", { params: { managersOnly: true } }),
        ]);
        const branchList = (branchRes.data || []) as { _id: string; name: string }[];
        setBranches(branchList);
        setEmployees((empRes.data || []).map((e: { _id: string; name: string }) => ({ _id: e._id, name: e.name })));

        const initialBranch = lockedBranch?._id || form.branch || (branchList.length === 1 ? branchList[0]._id : "");
        if (initialBranch) {
          if (!form.branch) {
            setForm((f) => ({ ...f, branch: initialBranch }));
          }
          const deptRes = (await axiosInstance.get("/departments", { params: { branch: initialBranch } })) as {
            data: { _id: string; name: string }[];
          };
          setDepartments(deptRes.data || []);
          if (form.department) {
            const desigRes = (await axiosInstance.get("/designations", {
              params: { branch: initialBranch, department: form.department },
            })) as { data: { _id: string; name: string }[] };
            setDesignations(desigRes.data || []);
          }
        }
      } catch { /* silently fail */ }
    };
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBranches = async () => {
    try {
      const res = (await axiosInstance.get("/branches")) as { data: { _id: string; name: string }[] };
      setBranches(res.data || []);
    } catch { /* silently fail */ }
  };

  // branch select garepachi tyo branch ka departments matra layine
  const fetchDepartments = async (branchId?: string) => {
    try {
      const bid = branchId || form.branch;
      const params: Record<string, string> = {};
      if (bid) params.branch = bid;
      const res = (await axiosInstance.get("/departments", { params })) as { data: { _id: string; name: string }[] };
      setDepartments(res.data || []);
    } catch { /* silently fail */ }
  };

  // department select garepachi tyo branch+department ko designations matra layine
  const fetchDesignations = async (deptId?: string, branchId?: string) => {
    try {
      const did = deptId || form.department;
      const bid = branchId || form.branch;
      const params: Record<string, string> = {};
      if (did) params.department = did;
      if (bid) params.branch = bid;
      const res = (await axiosInstance.get("/designations", { params })) as { data: { _id: string; name: string }[] };
      setDesignations(res.data || []);
    } catch { /* silently fail */ }
  };

  // branch change huda department/designation reset + filter
  const handleBranchChange = (v: string) => {
    if (lockedBranch) return;
    setForm((f) => ({ ...f, branch: v, department: "", designation: "" }));
    setDepartments([]);
    setDesignations([]);
    if (v) fetchDepartments(v);
  };

  // department change huda designation reset + filter
  const handleDepartmentChange = (v: string) => {
    setForm((f) => ({ ...f, department: v, designation: "" }));
    setDesignations([]);
    if (v) fetchDesignations(v, form.branch);
  };

  // POST /users creates both a User (login) + Employee (profile) in one shot
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^[0-9]{7,15}$/.test(form.phone.trim())) {
      toast.error("Phone must contain numbers only (7-15 digits)");
      return;
    }

    // joining date custom picker ho, browser required le cover garna sakdaina
    if (!form.joiningDate) {
      toast.error("Joining date is required");
      return;
    }

    try {
      setLoading(true);
      // username = full name
      const res = await axiosInstance.post("/users", {
        ...form,
        username: form.name.trim(),
        branch: lockedBranch?._id || form.branch,
      });
      // photo select gareko cha bhane naya employee ma upload garne
      const newEmployeeId = (res as unknown as { data?: { employee?: { _id?: string } } })?.data?.employee?._id;
      if (imageFile && newEmployeeId) {
        try {
          await uploadEmployeeImage(newEmployeeId, imageFile);
        } catch {
          toast.error("Employee created but photo upload failed");
        }
      }
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {
        // ignore
      }
      toast.success((res as { message?: string })?.message || "Employee created successfully — login credentials sent via email");
      onCreated();
    } catch (error) {
      toastApiErrors(error, "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add New Employee"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto outline-none"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-bold text-lg text-slate-900">Add New Employee</h3>
            {draftRestored && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-700">
                <Bookmark size={11} /> Draft Restored
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {hasEmployeeDraftContent(form) && (
              <button
                type="button"
                onClick={handleClearDraft}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title="Clear all fields and discard draft"
              >
                <RotateCcw size={13} /> Clear
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close modal" className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quick-fill banner for Owner / Super Admin to create their own Employee profile */}
          {authUser?.email && !ownerHasEmployeeProfile && form.email.toLowerCase() !== authUser.email.toLowerCase() && (
            <div className="rounded-xl border border-primary/25 bg-secondary/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Adding your own Employee profile?</p>
                  <p className="text-[11px] text-slate-600">
                    Link an employee profile directly to your account ({authUser.email}).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleFillOwnerDetails}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Use My Account
              </button>
            </div>
          )}

          {/* Photo upload + instant preview */}
          <ProfileImageUpload
            name={form.name || "New Employee"}
            currentImage={null}
            file={imageFile}
            onChange={setImageFile}
            onRemove={imageFile ? () => setImageFile(null) : undefined}
            size="md"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-emp-id" className="block text-sm font-medium text-slate-700 mb-1">Employee ID</label>
              <input id="create-emp-id" type="text" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
            </div>
            <div>
              <label htmlFor="create-emp-name" className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input id="create-emp-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-emp-email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input id="create-emp-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
            </div>
            <div>
              <label htmlFor="create-emp-phone" className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input id="create-emp-phone" type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={15} minLength={7} placeholder="Numbers only" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-emp-role" className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select
                id="create-emp-role"
                value="employee"
                disabled
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none bg-slate-100 text-slate-400"
              >
                <option value="employee">Employee</option>
              </select>
            </div>
            <GenderSelect value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EntityPicker
              entity="branch"
              label="Branch"
              value={form.branch}
              onChange={handleBranchChange}
              items={lockedBranch ? [lockedBranch] : branches}
              onRefresh={fetchBranches}
              disabled={!!lockedBranch}
              required
            />
            <div>
              <BSCalendarInput
                label="Joining Date"
                value={form.joiningDate ? parseLocalDate(form.joiningDate) : null}
                onChange={(d) => setForm({ ...form, joiningDate: d ? toLocalDateInput(d) : "" })}
                placeholder="Select joining date"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EntityPicker
              entity="department"
              label="Department"
              value={form.department}
              onChange={handleDepartmentChange}
              items={departments}
              onRefresh={() => fetchDepartments()}
              extraPayload={{ branch: form.branch }}
              placeholder={form.branch ? "Select department" : "Select a branch first"}
              disabled={!form.branch}
              required
            />
            <div>
              <EntityPicker
                entity="designation"
                label="Designation"
                value={form.designation}
                onChange={(v) => setForm({ ...form, designation: v })}
                items={designations}
                onRefresh={() => fetchDesignations()}
                extraPayload={{ branch: form.branch, department: form.department }}
                placeholder={form.department ? "Select designation" : "Select a department first"}
                disabled={!form.department}
                required
              />
            </div>
          </div>
          {/* Manager select - employee ko lagi */}
          <div>
            <label htmlFor="create-emp-manager" className="block text-sm font-medium text-slate-700 mb-1">Reporting Manager (Optional)</label>
            <select id="create-emp-manager" value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white">
              <option value="">No Manager (Reports directly to Admin / HR)</option>
              {employees.map((emp) => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Assigns a team supervisor. Only staff created with the &apos;Manager&apos; role appear in this list.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-slate-600 hover:bg-secondary/30">Cancel</button>
            <button
              type="button"
              onClick={handleSaveAsDraft}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              <Bookmark size={15} /> Save as Draft
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50">
              {loading ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit employee modal - lockedBranch/managerMode le fields locked
function EditEmployeeModal({ employee, onClose, onUpdated, lockedBranch, managerMode }: { employee: IEmployeeData; onClose: () => void; onUpdated: () => void; lockedBranch?: IOption | null; managerMode?: boolean }) {
  const [form, setForm] = useState({
    name: employee.name,
    email: employee.email,
    phone: (employee.phone || "").replace(/\D/g, ""),
    department: employee.department?._id || "",
    designation: employee.designation?._id || "",
    branch: lockedBranch?._id || employee.branch?._id || "",
    status: employee.status || "active",
    gender: employee.gender || "",
    manager: employee.manager?._id || "",
  });
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ _id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ _id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  // photo - select garda instant preview, save pachhi upload/delete huncha
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeRequested, setRemoveRequested] = useState(false);
  const editModalRef = useModalAccessibility<HTMLDivElement>(onClose);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const branchId = employee.branch?._id || "";
        const deptId = employee.department?._id || "";
        const [deptRes, desigRes, branchRes, empRes] = await Promise.all([
          axiosInstance.get("/departments", { params: branchId ? { branch: branchId } : {} }),
          axiosInstance.get("/designations", { params: deptId ? { department: deptId, branch: branchId || undefined } : {} }),
          axiosInstance.get("/branches"),
          axiosInstance.get("/employees", { params: { managersOnly: true } }),
        ]);
        setDepartments(deptRes.data || []);
        setDesignations(desigRes.data || []);
        setBranches(branchRes.data || []);
        setEmployees((empRes.data || []).map((e: { _id: string; name: string }) => ({ _id: e._id, name: e.name })));
      } catch { /* silently fail */ }
    };
    fetchData();
  }, [employee]);

  const fetchDepartments = async (branchId?: string) => {
    try {
      const bid = branchId || form.branch;
      const params: Record<string, string> = {};
      if (bid) params.branch = bid;
      const res = (await axiosInstance.get("/departments", { params })) as { data: { _id: string; name: string }[] };
      setDepartments(res.data || []);
    } catch { /* silently fail */ }
  };

  const fetchDesignations = async (deptId?: string, branchId?: string) => {
    try {
      const did = deptId || form.department;
      const bid = branchId || form.branch;
      const params: Record<string, string> = {};
      if (did) params.department = did;
      if (bid) params.branch = bid;
      const res = (await axiosInstance.get("/designations", { params })) as { data: { _id: string; name: string }[] };
      setDesignations(res.data || []);
    } catch { /* silently fail */ }
  };

  const fetchBranches = async () => {
    try {
      const res = (await axiosInstance.get("/branches")) as { data: { _id: string; name: string }[] };
      setBranches(res.data || []);
    } catch { /* silently fail */ }
  };

  const handleBranchChange = (v: string) => {
    if (lockedBranch) return;
    setForm((f) => ({ ...f, branch: v, department: "", designation: "" }));
    setDepartments([]);
    setDesignations([]);
    if (v) fetchDepartments(v);
  };

  const handleDepartmentChange = (v: string) => {
    setForm((f) => ({ ...f, department: v, designation: "" }));
    setDesignations([]);
    if (v) fetchDesignations(v, form.branch);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{7,15}$/.test(form.phone.trim())) {
      toast.error("Phone must contain numbers only (7-15 digits)");
      return;
    }
    try {
      setLoading(true);
      const res = await axiosInstance.put(`/employees/${employee._id}`, {
        ...form,
        branch: lockedBranch?._id || form.branch,
      }) as unknown as { message?: string; temporaryPassword?: string };

      // photo change: naya file cha bhane upload, remove thicheko cha bhane delete
      if (imageFile) {
        try {
          await uploadEmployeeImage(employee._id, imageFile);
        } catch {
          toast.error("Employee updated but photo upload failed");
        }
      } else if (removeRequested) {
        try {
          await axiosInstance.delete(`/employees/${employee._id}/profile-image`);
        } catch {
          toast.error("Employee updated but photo remove failed");
        }
      }

      if (res.temporaryPassword) {
        toast.error(`Employee updated, but the credential email to the new address failed. Login password to share: ${res.temporaryPassword}`);
      } else {
        toast.success(res.message || "Employee updated successfully");
      }
      onUpdated();
    } catch (error) {
      toastApiErrors(error, "Failed to update employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={editModalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit Employee"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto outline-none"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-900">Edit Employee</h3>
          <button type="button" onClick={onClose} aria-label="Close modal" className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Photo upload - super_admin/hr_admin lai matra; manager lai readonly avatar */}
          {managerMode ? (
            <div className="flex items-center gap-3">
              <Avatar name={employee.name} imageUrl={employee.profileImage} size="lg" gender={employee.gender} />
              <div>
                <p className="text-lg font-bold text-slate-900">{employee.name}</p>
                <p className="text-sm text-slate-500">{employee.employeeId}</p>
              </div>
            </div>
          ) : (
            <ProfileImageUpload
              name={form.name || employee.name}
              currentImage={removeRequested ? null : employee.profileImage}
              file={imageFile}
              onChange={(f) => {
                setImageFile(f);
                if (f) setRemoveRequested(false);
              }}
              onRemove={
                imageFile || (!removeRequested && employee.profileImage)
                  ? () => {
                      setImageFile(null);
                      setRemoveRequested(true);
                    }
                  : undefined
              }
              size="md"
            />
          )}
          <div>
            <label htmlFor="edit-emp-name" className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input id="edit-emp-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-emp-email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input id="edit-emp-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
            </div>
            <div>
              <label htmlFor="edit-emp-phone" className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input id="edit-emp-phone" type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={15} minLength={7} placeholder="Numbers only" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EntityPicker
              entity="branch"
              label="Branch"
              value={form.branch}
              onChange={handleBranchChange}
              items={lockedBranch ? [lockedBranch] : branches}
              onRefresh={fetchBranches}
              disabled={!!lockedBranch || managerMode}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-emp-role" className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select id="edit-emp-role" value="employee" disabled className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none bg-slate-100 text-slate-400">
                <option value="employee">Employee</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-emp-status" className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select id="edit-emp-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EntityPicker
              entity="department"
              label="Department"
              value={form.department}
              onChange={handleDepartmentChange}
              items={departments}
              onRefresh={() => fetchDepartments()}
              extraPayload={{ branch: form.branch }}
              placeholder={form.branch ? "Select department" : "Select a branch first"}
              disabled={!form.branch || managerMode}
              required
            />
            <EntityPicker
              entity="designation"
              label="Designation"
              value={form.designation}
              onChange={(v) => setForm({ ...form, designation: v })}
              items={designations}
              onRefresh={() => fetchDesignations()}
              extraPayload={{ branch: form.branch, department: form.department }}
              placeholder={form.department ? "Select designation" : "Select a department first"}
              disabled={!form.department}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GenderSelect value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} required />
            <div>
              <label htmlFor="edit-emp-manager" className="block text-sm font-medium text-slate-700 mb-1">Reporting Manager</label>
              <select id="edit-emp-manager" value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} disabled={managerMode} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white disabled:bg-slate-50 disabled:text-slate-400">
                <option value="">No Manager (Reports directly to Admin / HR)</option>
                {employees.filter((emp) => emp._id !== employee._id).map((emp) => (
                  <option key={emp._id} value={emp._id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-5 py-2.5 rounded-xl border border-border text-sm text-slate-600 hover:bg-secondary/30">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50">
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
