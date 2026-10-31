import { useEffect, useState } from "react";
import { Plus, Trash2, BriefcaseBusiness, Edit3, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EntityCreateModal, { type EntityCreateData } from "../../components/common/EntityCreateModal";
import axiosInstance from "../../config/ApiClient";

// card grid (3-col) ko lagi valid per-page options - default 9 include huncha
const DESIGNATION_PAGE_SIZE_OPTIONS = [6, 9, 12, 15, 24];

interface IDesignation {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  branch?: {
    _id: string;
    name: string;
  } | null;
  department?: {
    _id: string;
    name: string;
  } | null;
}

// yo page le designations dekhauxa ra CRUD garna dinxa
export default function Designations() {
  const [designations, setDesignations] = useState<IDesignation[]>([]);
  const [branchCount, setBranchCount] = useState<number | null>(null);
  const [deptCount, setDeptCount] = useState<number | null>(null);
  const [quickEntityModal, setQuickEntityModal] = useState<"branch" | "department" | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<IDesignation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IDesignation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const totalPages = Math.max(1, Math.ceil(designations.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, designations.length);
  const pagedDesignations = designations.slice(start, start + pageSize);

  // list shrink huda page auto-clamp garne
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
  };

  const handlePageSizeChange = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [res, branchRes, deptRes] = await Promise.all([
        axiosInstance.get("/designations"),
        axiosInstance.get("/branches").catch(() => ({ data: [] })),
        axiosInstance.get("/departments").catch(() => ({ data: [] })),
      ]);
      setDesignations(res.data || []);
      setBranchCount((branchRes.data || []).length);
      setDeptCount((deptRes.data || []).length);
    } catch {
      toast.error("Failed to fetch designations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
  }, []);

  const openCreate = () => { setEditItem(null); setShowModal(true); };
  const openEdit = (d: IDesignation) => { setEditItem(d); setShowModal(true); };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await axiosInstance.delete(`/designations/${deleteTarget._id}`);
      toast.success("Designation deleted");
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error("You don't have access to delete this designation");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Designations</h1>
          <p className="mt-1 text-slate-500">Manage job titles and positions</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
          <Plus size={18} /> Add Designation
        </button>
      </div>

      {!loading && branchCount === 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">No branches added yet</p>
              <p className="text-xs text-amber-800 mt-0.5">
                You must create a Branch and Department before adding a Designation.
              </p>
            </div>
          </div>
          <button
            onClick={() => setQuickEntityModal("branch")}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
          >
            <Plus size={15} /> Create Branch First
          </button>
        </div>
      )}

      {!loading && branchCount !== null && branchCount > 0 && deptCount === 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">No departments added yet</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Every designation belongs to a department. Please add a Department first.
              </p>
            </div>
          </div>
          <button
            onClick={() => setQuickEntityModal("department")}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
          >
            <Plus size={15} /> Create Department First
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : designations.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No designations found</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {pagedDesignations.map((d) => (
              <div key={d._id} className="p-5 rounded-2xl border border-border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <BriefcaseBusiness size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{d.name}</p>
                    {d.code && <p className="text-xs text-slate-500">{d.code}</p>}
                    {d.department?.name && <p className="text-[11px] text-slate-500 mt-0.5">{d.department.name}</p>}
                    {d.branch?.name && <p className="text-[11px] text-slate-400">{d.branch.name}</p>}
                  </div>
                </div>
                {d.description && (
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{d.description}</p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(d)} aria-label={`Edit ${d.name}`} title="Edit" className="p-2 rounded-xl text-amber-500 hover:bg-amber-50 transition-colors"><Edit3 size={14} /></button>
                  <button type="button" onClick={() => setDeleteTarget(d)} aria-label={`Delete ${d.name}`} title="Delete" className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && designations.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {designations.length === 0 ? 0 : start + 1}–{end} of {designations.length} designations
              </p>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                Show
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="border border-border rounded-lg px-2 py-1 bg-white text-xs outline-none focus:border-primary"
                >
                  {DESIGNATION_PAGE_SIZE_OPTIONS.map((n) => (
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
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage <= 1}
                aria-label="Previous page"
                className="p-2 rounded-lg border border-border text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-500 whitespace-nowrap">
                Page {safePage} / {totalPages}
              </span>
              <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage >= totalPages}
                aria-label="Next page"
                className="p-2 rounded-lg border border-border text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal - shared EntityCreateModal use gareko */}
      <EntityCreateModal
        key={`desig-${editItem?._id ?? "new"}-${showModal}`}
        entity="designation"
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={fetchData}
        initial={editItem ? { name: editItem.name, code: editItem.code || "", description: editItem.description || "", branch: editItem.branch?._id || "", department: editItem.department?._id || "" } satisfies EntityCreateData : null}
        editId={editItem?._id}
      />

      {quickEntityModal && (
        <EntityCreateModal
          key={`quick-${quickEntityModal}`}
          entity={quickEntityModal}
          open={!!quickEntityModal}
          onClose={() => setQuickEntityModal(null)}
          onCreated={() => {
            setQuickEntityModal(null);
            void fetchData();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        variant="danger"
        title="Delete designation?"
        description="This job title will be permanently removed."
        itemName={deleteTarget?.name}
        details={[
          "Employees with this designation will become unassigned",
          "You can recreate the designation later if needed",
        ]}
        confirmLabel="Delete designation"
        isLoading={isDeleting}
      />
    </div>
  );
}
