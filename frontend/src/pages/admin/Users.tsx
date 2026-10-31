import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserRound,
  BriefcaseBusiness,
  MapPin,
  Shield,
  X,
  Pencil,
  Plus,
  Bookmark,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Avatar from "../../components/common/Avatar";
import GenderSelect from "../../components/common/GenderSelect";
import EntityPicker from "../../components/common/EntityPicker";
import ProfileImageUpload from "../../components/common/ProfileImageUpload";
import BSCalendarInput from "../../components/ui/BSCalendarInput";
import type { IProfileImage } from "../../lib/profileImage";
import { toastApiErrors } from "../../lib/apiErrors";
import { formatDate, parseLocalDate, toLocalDateInput } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import { useModalAccessibility } from "../../lib/hooks/useModalAccessibility";
import { useAppSelector } from "../../lib/hooks/redux";

// user photo upload helper - create pachhi call garne
async function uploadUserImage(employeeId: string, f: File) {
  const fd = new FormData();
  fd.append("profileImage", f);
  await axiosInstance.post(`/employees/${employeeId}/profile-image`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

// user data ko type
interface IUserData {
  _id: string;
  email: string;
  username?: string | null;
  role: string;
  status: string;
  createdAt: string;
  profileImage?: IProfileImage | null;
  employee?: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    employeeId: string;
    profileImage?: IProfileImage | null;
    department?: { _id: string; name: string; code: string } | null;
    designation?: { _id: string; name: string } | null;
    branch?: { _id: string; name: string; code: string } | null;
    manager?: { _id: string; name: string; employeeId: string } | null;
    status?: string;
    gender?: "male" | "female" | "other" | null;
    joiningDate?: string | null;
  } | null;
}

// pagination ko type
interface IPagination {
  limit: number;
  skip: number;
  total: number;
  page: number;
  totalPage: number;
}

interface IUsersResponse {
  data: IUserData[];
  meta: { pagination: IPagination };
}

// dropdown option ko type
interface IOption {
  _id: string;
  name: string;
}

// API error bata readable message nikalne helper
function getErrorMessage(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}

// user list - super_admin/hr_admin full, manager lai dekhidaina
export default function Users() {
  const calPref = useCalendarPreference();
  const { authUser } = useAppSelector((state) => state.auth);
  const canManageUsers = authUser?.role === "super_admin" || authUser?.role === "hr_admin";
  const [users, setUsers] = useState<IUserData[]>([]);
  const [pagination, setPagination] = useState<IPagination>({ limit: 5, skip: 0, total: 0, page: 1, totalPage: 1 });
  const [pageSize, setPageSize] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  // aafnai branch scope - add user form ma branch lock garna
  const [ownBranch, setOwnBranch] = useState<IOption | null>(null);

  // filters: role + branch → department cascade
  const [roleFilter, setRoleFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [branches, setBranches] = useState<IOption[]>([]);
  const [departments, setDepartments] = useState<IOption[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<IUserData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IUserData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // branch-scoped hr_admin ko aafno branch lock ko lagi (add user form ma)
  useEffect(() => {
    if (authUser?.role !== "hr_admin") return;
    let active = true;
    (async () => {
      try {
        const me = (await axiosInstance.get("/employees/me")) as unknown as {
          data?: { employee?: { branch?: { _id: string; name: string } | null } | null };
        };
        const b = me?.data?.employee?.branch;
        if (active && b?._id) setOwnBranch({ _id: b._id, name: b.name });
      } catch { /* silently fail - unscoped (all branches) */ }
    })();
    return () => { active = false; };
  }, [authUser?.role]);

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

  // users fetch garxa (pagination/filter/search/delete pachi refresh ko lagi)
  const fetchUsers = useCallback(async (page = 1, q = "", opts?: { role?: string; branch?: string; department?: string }) => {
    try {
      setLoading(true);
      const skip = (page - 1) * pageSize;
      const params: Record<string, string | number> = { limit: pageSize, skip };
      if (q) params.q = q;
      if (opts?.role) params.role = opts.role;
      if (opts?.branch) params.branch = opts.branch;
      if (opts?.department) params.department = opts.department;
      // interceptor le envelope {data, message, meta} return garcha
      const response = (await axiosInstance.get("/users", { params })) as unknown as IUsersResponse;
      setUsers(response.data);
      setPagination(response.meta.pagination);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to fetch users"));
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  // initial load - active flag pattern (react-hooks v7 lint rule)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params: Record<string, string | number> = { limit: pageSize, skip: 0 };
        if (searchQuery) params.q = searchQuery;
        if (roleFilter) params.role = roleFilter;
        if (branchFilter) params.branch = branchFilter;
        if (departmentFilter) params.department = departmentFilter;
        const response = (await axiosInstance.get("/users", { params })) as unknown as IUsersResponse;
        if (!active) return;
        setUsers(response.data);
        setPagination(response.meta.pagination);
      } catch (error) {
        if (active) toast.error(getErrorMessage(error, "Failed to fetch users"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [searchQuery, roleFilter, branchFilter, departmentFilter, pageSize]);

  // search handle garxa
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1, searchQuery, { role: roleFilter, branch: branchFilter, department: departmentFilter });
  };

  const handleRoleFilter = (id: string) => {
    setRoleFilter(id);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleBranchFilter = (id: string) => {
    setBranchFilter(id);
    setDepartmentFilter("");
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleDepartmentFilter = (id: string) => {
    setDepartmentFilter(id);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  // haleko filters lai fetchUsers ko opts ma pathaune helper
  const currentOpts = () => ({ role: roleFilter, branch: branchFilter, department: departmentFilter });

  // user delete garxa - sensitive: requires I agree + type DELETE
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await axiosInstance.delete(`/users/${deleteTarget._id}`);
      toast.success("User deleted successfully");
      setDeleteTarget(null);
      fetchUsers(pagination.page, searchQuery, currentOpts());
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete user"));
    } finally {
      setIsDeleting(false);
    }
  };

  // role ko color return garxa
  const getRoleBadge = (role: string) => {
    const map: Record<string, string> = {
      super_admin: "bg-secondary text-primary",
      hr_admin: "bg-secondary text-primary",
      manager: "bg-amber-100 text-amber-700",
      employee: "bg-secondary text-primary",
    };
    return map[role] || "bg-surface text-gray-700";
  };

  const formatRole = (role: string) => {
    const map: Record<string, string> = {
      platform_admin: "Platform Admin",
      super_admin: "Super Admin",
      hr_admin: "HR / Admin",
      manager: "Manager",
      employee: "Employee",
    };
    return map[role] || role;
  };

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Accounts</h1>
          <p className="mt-1 text-gray-500">
            {canManageUsers
              ? "Manage HR / Admin and Manager login accounts"
              : "View login accounts"}
          </p>
        </div>
        {canManageUsers && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium text-sm shadow-lg shadow-primary/20 transition-colors"
          >
            <Plus size={18} />
            Add User
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-lg border border-border p-4">
        <form onSubmit={handleSearch} className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            aria-label="Search users"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username, email, role, employee name..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </form>
      </div>

      {/* Filters: Role + Branch → Department */}
      <div className="bg-white rounded-lg border border-border p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="user-filter-role" className="block text-[11px] font-medium text-gray-500 mb-1">Role</label>
          <select
            id="user-filter-role"
            value={roleFilter}
            onChange={(e) => handleRoleFilter(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary"
          >
            <option value="">All Roles</option>
            <option value="hr_admin">HR / Admin</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        <div>
          <label htmlFor="user-filter-branch" className="block text-[11px] font-medium text-gray-500 mb-1">Branch</label>
          <select
            id="user-filter-branch"
            value={branchFilter}
            onChange={(e) => handleBranchFilter(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary"
          >
            <option value="">All Branches</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>{branch.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="user-filter-department" className="block text-[11px] font-medium text-gray-500 mb-1">Department</label>
          <select
            id="user-filter-department"
            value={departmentFilter}
            onChange={(e) => handleDepartmentFilter(e.target.value)}
            disabled={!branchFilter}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-white outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">{!branchFilter ? "Select branch first" : deptLoading ? "Loading..." : "All Departments"}</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>{dept.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No users found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-surface-muted">
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">User</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Role</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Employee</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Department</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Branch</th>
                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id} className="border-b border-gray-50 hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={user.employee?.name || user.username || user.email}
                            imageUrl={user.employee?.profileImage || user.profileImage}
                            gender={user.employee?.gender}
                            size="sm"
                            rounded="rounded-full"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-800">{user.username || user.email}</p>
                            <p className="text-[11px] text-gray-500">Created {formatDate(new Date(user.createdAt), calPref)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                          <Shield size={12} />
                          {formatRole(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.employee ? (
                          <div className="flex items-center gap-2">
                            <UserRound size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-700">{user.employee.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.employee?.department ? (
                          <div className="flex items-center gap-2">
                            <BriefcaseBusiness size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-700">{user.employee.department.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.employee?.branch ? (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-700">{user.employee.branch.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {canManageUsers ? (
                          <div className="flex items-center gap-1">
                            {user.role !== "super_admin" && (
                              <button
                                onClick={() => setEditingUser(user)}
                                aria-label={`Edit ${user.username || user.email}`}
                                className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-secondary transition-colors"
                                title="Edit user"
                              >
                                <Pencil size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteTarget(user)}
                              aria-label={`Delete ${user.username || user.email}`}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete user"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-gray-500">
                  Showing {pagination.skip + 1} - {Math.min(pagination.skip + pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                  Show
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
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
                  onClick={() => fetchUsers(pagination.page - 1, searchQuery, currentOpts())}
                  disabled={pagination.page <= 1}
                  aria-label="Previous page"
                  className="p-2 rounded-lg border border-border bg-white text-gray-600 hover:bg-secondary/30 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: pagination.totalPage }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    onClick={() => fetchUsers(pg, searchQuery, currentOpts())}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      pg === pagination.page
                        ? "bg-primary text-white"
                        : "border border-border bg-white text-gray-600 hover:bg-secondary/30"
                    }`}
                  >
                    {pg}
                  </button>
                ))}
                <button
                  onClick={() => fetchUsers(pagination.page + 1, searchQuery, currentOpts())}
                  disabled={pagination.page >= pagination.totalPage}
                  aria-label="Next page"
                  className="p-2 rounded-lg border border-border bg-white text-gray-600 hover:bg-secondary/30 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add User Modal - super_admin/hr_admin lai matra */}
      {canManageUsers && showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); fetchUsers(pagination.page, searchQuery, currentOpts()); }}
          lockedBranch={ownBranch}
          isSuperAdmin={authUser?.role === "super_admin"}
        />
      )}

      {/* Edit User Modal - super_admin/hr_admin lai matra */}
      {canManageUsers && editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={() => { setEditingUser(null); fetchUsers(pagination.page, searchQuery, currentOpts()); }}
          isSuperAdmin={authUser?.role === "super_admin"}
          lockedBranch={ownBranch}
        />
      )}

      {/* Delete User Confirmation - SENSITIVE - super_admin lai matra */}
      <ConfirmDialog
        open={canManageUsers && !!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        variant="sensitive"
        title="Remove user account?"
        description="This will remove the user's login access. Their employee history is kept and stays visible in reports (highlighted as Removed)."
        itemName={deleteTarget ? `${deleteTarget.username || deleteTarget.email} — ${formatRole(deleteTarget.role)}` : undefined}
        details={[
          "User will be signed out and lose access immediately",
          "Linked employee is marked removed - attendance and leave history is preserved for reports",
          "You will need to recreate the account to restore access",
        ]}
        confirmLabel="Delete user"
        isLoading={isDeleting}
      />
    </div>
  );
}

// Edit user modal - employee profile + role/email/status sabai edit garna milne (Employee sidebar jastai)
function EditUserModal({ user, onClose, onUpdated, isSuperAdmin, lockedBranch }: { user: IUserData; onClose: () => void; onUpdated: () => void; isSuperAdmin: boolean; lockedBranch?: IOption | null }) {
  const modalRef = useModalAccessibility(onClose);
  const roleLabels: Record<string, string> = { employee: "Employee", manager: "Manager", hr_admin: "HR / Admin" };
  // Users sidebar: employee bahek - super_admin lai hr_admin+manager, hr_admin lai manager matra
  const baseRoles = isSuperAdmin ? ["manager", "hr_admin"] : ["manager"];
  const visibleRoles = baseRoles.includes(user.role) ? baseRoles : [user.role, ...baseRoles];

  const [form, setForm] = useState({
    email: user.email,
    role: user.role,
    status: user.status || "active",
    name: user.employee?.name || user.username || "",
    phone: (user.employee?.phone || "").replace(/\D/g, ""),
    branch: lockedBranch?._id || user.employee?.branch?._id || "",
    department: user.employee?.department?._id || "",
    designation: user.employee?.designation?._id || "",
    gender: user.employee?.gender || "",
    joiningDate: user.employee?.joiningDate || "",
  });
  const isHrAdminRole = form.role === "hr_admin";
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ _id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ _id: string; name: string }[]>([]);
  // photo - select garda instant preview, save pachhi upload/delete huncha
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeRequested, setRemoveRequested] = useState(false);
  const employeeId = user.employee?._id || "";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const branchId = form.branch;
        const deptId = form.department;
        const [deptRes, desigRes, branchRes] = await Promise.all([
          axiosInstance.get("/departments", { params: branchId ? { branch: branchId } : {} }),
          axiosInstance.get("/designations", { params: deptId ? { department: deptId, branch: branchId || undefined } : {} }),
          axiosInstance.get("/branches"),
        ]);
        setDepartments(deptRes.data || []);
        setDesignations(desigRes.data || []);
        setBranches(branchRes.data || []);
      } catch { /* silently fail */ }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user._id]);

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

  const handleRoleChange = (v: string) => {
    setForm((f) => ({ ...f, role: v, department: v === "hr_admin" ? "" : f.department, designation: v === "hr_admin" ? "" : f.designation }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.branch) {
      toast.error("Branch is required so attendance (check-in / check-out) works for this user");
      return;
    }
    if (form.role !== "hr_admin" && !form.department) {
      toast.error("Department is required for a Manager user");
      return;
    }
    if (!/^[0-9]{7,15}$/.test(form.phone.trim())) {
      toast.error("Phone must contain numbers only (7-15 digits)");
      return;
    }
    try {
      setLoading(true);
      const res = await axiosInstance.put(`/users/${user._id}`, {
        email: form.email,
        role: form.role,
        status: form.status,
        name: form.name,
        phone: form.phone,
        branch: lockedBranch?._id || form.branch,
        department: isHrAdminRole ? "" : form.department,
        designation: isHrAdminRole ? "" : form.designation,
        gender: form.gender,
        joiningDate: form.joiningDate,
      }) as unknown as { message?: string; temporaryPassword?: string };

      // photo change: naya file cha bhane upload, remove thicheko cha bhane delete
      if (imageFile && employeeId) {
        try {
          await uploadUserImage(employeeId, imageFile);
        } catch {
          toast.error("User updated but photo upload failed");
        }
      } else if (removeRequested && employeeId) {
        try {
          await axiosInstance.delete(`/employees/${employeeId}/profile-image`);
        } catch {
          toast.error("User updated but photo remove failed");
        }
      }

      if (res.temporaryPassword) {
        toast.error(`User updated, but the credential email to the new address failed. Login password to share: ${res.temporaryPassword}`);
      } else {
        toast.success(res.message || "User updated successfully");
      }
      onUpdated();
    } catch (error) {
      toastApiErrors(error, "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-modal-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h3 id="edit-user-modal-title" className="font-bold text-lg text-gray-900">Edit User</h3>
          <button onClick={onClose} aria-label="Close modal" className="p-2 rounded-lg hover:bg-secondary/30 text-gray-400">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Photo upload */}
          {employeeId ? (
            <ProfileImageUpload
              name={form.name || user.username || user.email}
              currentImage={removeRequested ? null : user.employee?.profileImage}
              file={imageFile}
              onChange={(f) => {
                setImageFile(f);
                if (f) setRemoveRequested(false);
              }}
              onRemove={
                imageFile || (!removeRequested && user.employee?.profileImage)
                  ? () => {
                      setImageFile(null);
                      setRemoveRequested(true);
                    }
                  : undefined
              }
              size="md"
            />
          ) : (
            <Avatar name={user.username || user.email} imageUrl={user.profileImage} size="lg" gender={user.employee?.gender} />
          )}

          <div>
            <label htmlFor="edit-user-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              id="edit-user-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-user-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="edit-user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label htmlFor="edit-user-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                id="edit-user-phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={15}
                minLength={7}
                placeholder="Numbers only"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-user-role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                id="edit-user-role"
                value={form.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary bg-white"
              >
                {visibleRoles.map((r) => (
                  <option key={r} value={r}>{roleLabels[r] || r}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-user-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                id="edit-user-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary bg-white capitalize"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
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
              disabled={!!lockedBranch}
              required
            />
            <GenderSelect value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} required />
          </div>
          <div>
            <BSCalendarInput
              label="Joining Date"
              value={form.joiningDate ? parseLocalDate(form.joiningDate) : null}
              onChange={(d) => setForm({ ...form, joiningDate: d ? toLocalDateInput(d) : "" })}
              placeholder="Select joining date"
            />
          </div>
          {!isHrAdminRole && (
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
              />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-5 py-2.5 rounded-lg border border-border text-sm text-gray-600 hover:bg-secondary/30">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium disabled:opacity-50 transition-colors">
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const USER_DRAFT_KEY = "attendance_draft_create_user";

function hasUserDraftContent(f: Record<string, string>): boolean {
  return Boolean(
    f.employeeId?.trim() ||
    f.name?.trim() ||
    f.email?.trim() ||
    f.phone?.trim() ||
    f.department?.trim() ||
    f.designation?.trim() ||
    f.joiningDate?.trim() ||
    f.gender?.trim()
  );
}

// Add user modal - role anusar fields
function AddUserModal({ onClose, onCreated, lockedBranch, isSuperAdmin }: { onClose: () => void; onCreated: () => void; lockedBranch?: IOption | null; isSuperAdmin: boolean }) {
  const modalRef = useModalAccessibility(onClose);
  // Users sidebar: employee role bahek - super_admin lai hr_admin+manager, hr_admin lai manager matra
  const roleOptions = isSuperAdmin ? ["manager", "hr_admin"] : ["manager"];
  const [draftRestored, setDraftRestored] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(USER_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        return hasUserDraftContent(parsed);
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
      role: "manager",
    };
    try {
      const raw = localStorage.getItem(USER_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<typeof base>;
        return {
          ...base,
          ...parsed,
          branch: lockedBranch?._id || parsed.branch || "",
        };
      }
    } catch {
      // ignore
    }
    return base;
  });
  // HR/Admin create garepachi branch/dept/designation chainadaina
  const isHrAdmin = form.role === "hr_admin";
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ _id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ _id: string; name: string }[]>([]);
  // photo - select garda instant preview, create pachi upload huncha
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    try {
      if (hasUserDraftContent(form)) {
        localStorage.setItem(USER_DRAFT_KEY, JSON.stringify(form));
      }
    } catch {
      // ignore
    }
  }, [form]);

  const handleSaveAsDraft = () => {
    try {
      localStorage.setItem(USER_DRAFT_KEY, JSON.stringify(form));
      toast.success("User details saved as draft!");
      onClose();
    } catch {
      toast.error("Failed to save draft");
    }
  };

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(USER_DRAFT_KEY);
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
      role: "manager",
    });
    setImageFile(null);
    toast.success("Draft cleared");
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const branchRes = await axiosInstance.get("/branches");
        const branchList = (branchRes.data || []) as { _id: string; name: string }[];
        setBranches(branchList);
        const initialBranch = lockedBranch?._id || form.branch || (branchList.length === 1 ? branchList[0]._id : "");
        if (initialBranch) {
          if (!form.branch) setForm((f) => ({ ...f, branch: initialBranch }));
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

    if (!form.branch) {
      toast.error("Branch is required so attendance (check-in / check-out) works for this user");
      return;
    }

    if (!isHrAdmin && !form.department) {
      toast.error("Department is required for a Manager user");
      return;
    }

    // joining date custom picker ho, browser required le cover garna sakdaina
    if (!form.joiningDate) {
      toast.error("Joining date is required");
      return;
    }

    try {
      setLoading(true);
      // HR/Admin lai pani branch chainchha (attendance check-in/out geofence ko lagi)
      const payload: Record<string, string> = {
        ...form,
        username: form.name.trim(),
        branch: lockedBranch?._id || form.branch,
      };
      if (isHrAdmin) {
        payload.department = "";
        payload.designation = "";
      }
      const res = await axiosInstance.post("/users", payload);
      // photo select gareko cha bhane naya user ko employee ma upload garne
      const newEmployeeId = (res as unknown as { data?: { employee?: { _id?: string } } })?.data?.employee?._id;
      if (imageFile && newEmployeeId) {
        try {
          await uploadUserImage(newEmployeeId, imageFile);
        } catch {
          toast.error("User created but photo upload failed");
        }
      }
      try {
        localStorage.removeItem(USER_DRAFT_KEY);
      } catch {
        // ignore
      }
      toast.success((res as { message?: string })?.message || "User created successfully — login credentials sent via email");
      onCreated();
    } catch (error) {
      toastApiErrors(error, "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-modal-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 id="add-user-modal-title" className="font-bold text-lg text-gray-900">Add User</h3>
            {draftRestored && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-700">
                <Bookmark size={11} /> Draft Restored
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {hasUserDraftContent(form) && (
              <button
                type="button"
                onClick={handleClearDraft}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <RotateCcw size={13} /> Clear
              </button>
            )}
            <button onClick={onClose} aria-label="Close modal" className="p-2 rounded-lg hover:bg-secondary/30 text-gray-400"><X size={20} /></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Photo upload + instant preview */}
          <ProfileImageUpload
            name={form.name || "New User"}
            currentImage={null}
            file={imageFile}
            onChange={setImageFile}
            onRemove={imageFile ? () => setImageFile(null) : undefined}
            size="md"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-user-id" className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <input id="add-user-id" type="text" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
            </div>
            <div>
              <label htmlFor="add-user-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input id="add-user-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-user-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input id="add-user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
            </div>
            <div>
              <label htmlFor="add-user-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input id="add-user-phone" type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={15} minLength={7} placeholder="Numbers only" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-user-role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                id="add-user-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white"
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{r === "hr_admin" ? "HR / Admin" : "Manager"}</option>
                ))}
              </select>
            </div>
            <GenderSelect value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} required />
          </div>
          {/* Branch + Joining Date - duitai role lai branch chainchha (attendance ko lagi) */}
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
          {!isHrAdmin && (
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
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2.5 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-gray-600 hover:bg-secondary/30">Cancel</button>
            <button
              type="button"
              onClick={handleSaveAsDraft}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              <Bookmark size={15} /> Save as Draft
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50">
              {loading ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
