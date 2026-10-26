import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Building2,
  Users,
  X,
  Search,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EntityCreateModal, { type EntityCreateData } from "../../components/common/EntityCreateModal";
import axiosInstance from "../../config/ApiClient";

// card grid vs members list ko page-size options
const DEPT_CARD_PAGE_SIZE_OPTIONS = [6, 9, 12, 15, 24];
const MEMBER_PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50];

interface IDepartment {
  _id: string;
  name: string;
  code: string;
  description?: string;
  branch?: {
    _id: string;
    name: string;
  } | null;
}

interface IDepartmentUser {
  _id: string;
  email: string;
  role: string;
  employee?: {
    name: string;
    employeeId: string;
    phone: string;
    department?: {
      _id: string;
      name: string;
    } | null;
  } | null;
}

// yo page le departments dekhauxa, edit garna dinxa, click garyo bhane tyo department ka users dekhauxa
export default function DepartmentList() {
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<IDepartment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IDepartment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // department users ko lagi
  const [selectedDept, setSelectedDept] = useState<IDepartment | null>(null);
  const [deptUsers, setDeptUsers] = useState<IDepartmentUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [deptPage, setDeptPage] = useState(1);
  const [memberPage, setMemberPage] = useState(1);
  const [deptPageSize, setDeptPageSize] = useState(9);
  const [memberPageSize, setMemberPageSize] = useState(10);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/departments");
      setDepartments(res.data || []);
    } catch {
      toast.error("Failed to fetch departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await fetchDepartments();
    })();
  }, []);

  // department ma click garepachi tyo department ka users fetch garxa
  const handleDeptClick = async (dept: IDepartment) => {
    setSelectedDept(dept);
    setDeptUsers([]);
    setLoadingUsers(true);
    setSearchUser("");
    setMemberPage(1);
    try {
      const res = await axiosInstance.get("/users", { params: { limit: 100, q: dept.name } });
      const users = (res.data || []).filter((u: IDepartmentUser) => {
        const empDept = u.employee?.department;
        return empDept?.name === dept.name || empDept?._id === dept._id;
      });
      setDeptUsers(users);
    } catch {
      toast.error("Failed to fetch department users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const openCreate = () => {
    setEditItem(null);
    setShowModal(true);
  };

  const openEdit = (d: IDepartment, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditItem(d);
    setShowModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await axiosInstance.delete(`/departments/${deleteTarget._id}`);
      toast.success("Department deleted");
      if (selectedDept?._id === deleteTarget._id) setSelectedDept(null);
      setDeleteTarget(null);
      fetchDepartments();
    } catch {
      toast.error("You don't have access to delete this department");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatRole = (role: string) => {
    const map: Record<string, string> = {
      super_admin: "Super Admin",
      hr_admin: "HR / Admin",
      manager: "Manager",
      employee: "Employee",
    };
    return map[role] || role;
  };

  // filtered users
  const filteredUsers = searchUser
    ? deptUsers.filter((u) => {
        const q = searchUser.toLowerCase();
        return (
          u.email.toLowerCase().includes(q) ||
          u.employee?.name?.toLowerCase().includes(q) ||
          u.employee?.employeeId?.toLowerCase().includes(q)
        );
      })
    : deptUsers;

  const deptTotalPages = Math.max(1, Math.ceil(departments.length / deptPageSize));
  const safeDeptPage = Math.min(Math.max(1, deptPage), deptTotalPages);
  const deptStart = (safeDeptPage - 1) * deptPageSize;
  const deptEnd = Math.min(deptStart + deptPageSize, departments.length);
  const pagedDepartments = departments.slice(deptStart, deptStart + deptPageSize);

  const memberTotalPages = Math.max(1, Math.ceil(filteredUsers.length / memberPageSize));
  const safeMemberPage = Math.min(Math.max(1, memberPage), memberTotalPages);
  const memberStart = (safeMemberPage - 1) * memberPageSize;
  const memberEnd = Math.min(memberStart + memberPageSize, filteredUsers.length);
  const pagedMembers = filteredUsers.slice(memberStart, memberStart + memberPageSize);

  // list shrink huda page auto-clamp garne
  useEffect(() => {
    if (deptPage > deptTotalPages) setDeptPage(deptTotalPages);
  }, [deptPage, deptTotalPages]);

  useEffect(() => {
    if (memberPage > memberTotalPages) setMemberPage(memberTotalPages);
  }, [memberPage, memberTotalPages]);

  const goToDeptPage = (p: number) => {
    setDeptPage(Math.min(Math.max(1, p), deptTotalPages));
  };

  const handleDeptPageSizeChange = (n: number) => {
    setDeptPageSize(n);
    setDeptPage(1);
  };

  const goToMemberPage = (p: number) => {
    setMemberPage(Math.min(Math.max(1, p), memberTotalPages));
  };

  const handleMemberPageSizeChange = (n: number) => {
    setMemberPageSize(n);
    setMemberPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="mt-1 text-slate-500">Click a department to view its members</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
          <Plus size={18} /> Add Department
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Department list - left side */}
        <div className={`${selectedDept ? "lg:col-span-1" : "lg:col-span-3"}`}>
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-500">Loading departments...</div>
            ) : departments.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No departments found</div>
            ) : (
              <div className={`grid gap-4 p-6 ${selectedDept ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
                {pagedDepartments.map((dept) => (
                  <div
                    key={dept._id}
                    onClick={() => handleDeptClick(dept)}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                      selectedDept?._id === dept._id
                        ? "border-primary bg-secondary shadow-md shadow-primary/10"
                        : "border-border hover:border-border hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        selectedDept?._id === dept._id ? "bg-primary text-white" : "bg-secondary text-primary"
                      }`}>
                        <Building2 size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">{dept.name}</p>
                        <p className="text-xs text-slate-500">{dept.code}</p>
                      </div>
                    </div>
                    {dept.description && (
                      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{dept.description}</p>
                    )}
                    {dept.branch?.name && (
                      <p className="text-[11px] text-slate-400 mb-3 inline-flex items-center gap-1">
                        <MapPin size={11} /> {dept.branch.name}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => openEdit(dept, e)} className="p-2 rounded-xl text-amber-500 hover:bg-amber-50 transition-colors" title="Edit">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(dept); }} className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                      <span className="ml-auto text-[11px] text-slate-400">Click to view members</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!loading && departments.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-xs text-slate-400">
                    Showing {departments.length === 0 ? 0 : deptStart + 1}–{deptEnd} of {departments.length} departments
                  </p>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400">
                    Show
                    <select
                      value={deptPageSize}
                      onChange={(e) => handleDeptPageSizeChange(Number(e.target.value))}
                      className="border border-border rounded-lg px-2 py-1 bg-white text-xs outline-none focus:border-primary"
                    >
                      {DEPT_CARD_PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    per page
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToDeptPage(safeDeptPage - 1)}
                    disabled={safeDeptPage <= 1}
                    aria-label="Previous page"
                    className="p-2 rounded-lg border border-border text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-2 text-xs font-semibold text-slate-500 whitespace-nowrap">
                    Page {safeDeptPage} / {deptTotalPages}
                  </span>
                  <button
                    onClick={() => goToDeptPage(safeDeptPage + 1)}
                    disabled={safeDeptPage >= deptTotalPages}
                    aria-label="Next page"
                    className="p-2 rounded-lg border border-border text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Department users - right side */}
        {selectedDept && (
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{selectedDept.name}</h3>
                    <p className="text-xs text-slate-500">{filteredUsers.length} member{filteredUsers.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedDept(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>

              {/* Search within department */}
              <div className="px-6 py-3 border-b border-slate-100">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Search members..."
                    className="w-full pl-9 pr-4 py-2 bg-secondary-muted/30 border border-border rounded-xl text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="p-6">
                {loadingUsers ? (
                  <div className="flex items-center gap-2 justify-center py-8 text-slate-500">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading members...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No members in this department</div>
                ) : (
                  <div className="space-y-2">
                    {pagedMembers.map((u) => (
                      <div key={u._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/30 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm">
                          {u.employee?.name?.charAt(0)?.toUpperCase() || u.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{u.employee?.name || u.email}</p>
                          <p className="text-[11px] text-slate-500 truncate">{u.employee?.employeeId || u.email}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                          u.role === "super_admin" ? "bg-secondary text-primary" :
                          u.role === "hr_admin" ? "bg-secondary text-primary" :
                          u.role === "manager" ? "bg-amber-100 text-amber-700" :
                          "bg-secondary text-primary"
                        }`}>
                          {formatRole(u.role)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {!loadingUsers && filteredUsers.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-xs text-slate-400">
                      Showing {filteredUsers.length === 0 ? 0 : memberStart + 1}–{memberEnd} of {filteredUsers.length} members
                    </p>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400">
                      Show
                      <select
                        value={memberPageSize}
                        onChange={(e) => handleMemberPageSizeChange(Number(e.target.value))}
                        className="border border-border rounded-lg px-2 py-1 bg-white text-xs outline-none focus:border-primary"
                      >
                        {MEMBER_PAGE_SIZE_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      per page
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => goToMemberPage(safeMemberPage - 1)}
                      disabled={safeMemberPage <= 1}
                      aria-label="Previous page"
                      className="p-2 rounded-lg border border-border text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="px-2 text-xs font-semibold text-slate-500 whitespace-nowrap">
                      Page {safeMemberPage} / {memberTotalPages}
                    </span>
                    <button
                      onClick={() => goToMemberPage(safeMemberPage + 1)}
                      disabled={safeMemberPage >= memberTotalPages}
                      aria-label="Next page"
                      className="p-2 rounded-lg border border-border text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal - shared EntityCreateModal use gareko (Employee create select bata pani yekai khulcha) */}
      <EntityCreateModal
        key={`dept-${editItem?._id ?? "new"}-${showModal}`}
        entity="department"
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={fetchDepartments}
        initial={editItem ? { name: editItem.name, code: editItem.code, description: editItem.description || "", branch: editItem.branch?._id || "" } satisfies EntityCreateData : null}
        editId={editItem?._id}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        variant="danger"
        title="Delete department?"
        description="This department will be permanently removed from the system."
        itemName={deleteTarget ? `${deleteTarget.name} (${deleteTarget.code})` : undefined}
        details={[
          "Employees in this department will become unassigned",
          "Department filter in reports will no longer include this name",
          "You can recreate the department later with the same name",
        ]}
        confirmLabel="Delete department"
        isLoading={isDeleting}
      />
    </div>
  );
}

