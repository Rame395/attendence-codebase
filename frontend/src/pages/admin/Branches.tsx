import { useEffect, useState } from "react";
import { Plus, Trash2, MapPin, Edit3, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import EntityCreateModal from "../../components/common/EntityCreateModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

// card grid (3-col) ko lagi valid per-page options - default 9 include huncha
const BRANCH_PAGE_SIZE_OPTIONS = [6, 9, 12, 15, 24];

interface IBranch {
  _id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  status: string;
}

// yo page le branches dekhauxa + geofence (lat/lng/radius) map bata set garna dinxa
export default function Branches() {
  const [branches, setBranches] = useState<IBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editBranch, setEditBranch] = useState<IBranch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IBranch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const totalPages = Math.max(1, Math.ceil(branches.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, branches.length);
  const pagedBranches = branches.slice(start, start + pageSize);

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

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = (await axiosInstance.get("/branches")) as { data: IBranch[] };
      setBranches(res.data || []);
    } catch {
      toast.error("Failed to fetch branches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await fetchBranches();
    })();
  }, []);

  const openCreate = () => {
    setEditBranch(null);
    setShowModal(true);
  };

  const openEdit = (b: IBranch) => {
    setEditBranch(b);
    setShowModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await axiosInstance.delete(`/branches/${deleteTarget._id}`);
      toast.success("Branch deleted");
      setDeleteTarget(null);
      fetchBranches();
    } catch {
      toast.error("Failed to delete branch");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Branches</h1>
          <p className="mt-1 text-slate-500">Office locations and geofencing</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
          <Plus size={18} /> Add Branch
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading branches...</div>
        ) : branches.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No branches found</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {pagedBranches.map((b) => (
              <div key={b._id} className="p-5 rounded-2xl border border-border hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                      <MapPin size={18} className="text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{b.name}</p>
                      <p className="text-xs text-slate-500">{b.code}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${b.status === "active" ? "bg-secondary text-primary" : "bg-slate-100 text-slate-500"}`}>
                    {b.status}
                  </span>
                </div>
                {b.address && <p className="text-xs text-slate-500 mb-3">{b.address}</p>}

                {/* geofence info */}
                <div className="rounded-xl bg-secondary-muted/30 border border-slate-100 p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Geofence radius</span>
                    <span className="font-semibold text-primary">{b.geofenceRadius}m</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Coordinates</span>
                    <span className="font-mono text-[10px] text-slate-600">
                      {b.latitude && b.longitude ? `${Number(b.latitude).toFixed(4)}, ${Number(b.longitude).toFixed(4)}` : "Not set"}
                    </span>
                  </div>
                  {!b.latitude && !b.longitude && (
                    <p className="text-[10px] text-red-500 pt-1">Location not configured - attendance will not work</p>
                  )}
                </div>

                <div className="flex gap-2 mt-3">
                  <button onClick={() => openEdit(b)} className="p-2 rounded-xl text-amber-500 hover:bg-amber-50 transition-colors"><Edit3 size={14} /></button>
                  <button onClick={() => setDeleteTarget(b)} className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && branches.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {branches.length === 0 ? 0 : start + 1}–{end} of {branches.length} branches
              </p>
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                Show
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="border border-border rounded-lg px-2 py-1 bg-white text-xs outline-none focus:border-primary"
                >
                  {BRANCH_PAGE_SIZE_OPTIONS.map((n) => (
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

      {/* Create/Edit Modal - shared EntityCreateModal (map + geofence included) */}
      <EntityCreateModal
        key={`branch-${editBranch?._id ?? "create"}-${showModal}`}
        entity="branch"
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={fetchBranches}
        initial={editBranch ? {
          name: editBranch.name,
          code: editBranch.code,
          address: editBranch.address || "",
          phone: editBranch.phone || "",
          latitude: editBranch.latitude || 0,
          longitude: editBranch.longitude || 0,
          geofenceRadius: editBranch.geofenceRadius || 20,
        } : null}
        editId={editBranch?._id}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        variant="danger"
        title="Delete branch?"
        description="This branch and its geofence configuration will be permanently removed."
        itemName={deleteTarget ? `${deleteTarget.name} (${deleteTarget.code})` : undefined}
        details={[
          "Employees assigned to this branch will become unassigned",
          "Check-in geofence for this location will stop working",
          "Historical attendance records remain but branch link will be cleared",
        ]}
        confirmLabel="Delete branch"
        isLoading={isDeleting}
      />
    </div>
  );
}
