import { useEffect, useState } from "react";
import { Plus, X, Plane, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import { formatDate, toLocalDateInput } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import BSCalendarRange from "../../components/ui/BSCalendarRange";
import Pagination from "../../components/common/Pagination";

interface ILeave {
  _id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  reviewReason?: string | null;
  attachment?: string | null;
  createdAt: string;
}

const LEAVE_TYPES = ["annual", "sick", "casual", "unpaid", "other"];

// employee leave page
export default function MyLeaves() {
  const calPref = useCalendarPreference();
  const [leaves, setLeaves] = useState<ILeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const totalPages = Math.max(1, Math.ceil(leaves.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedLeaves = leaves.slice(start, start + pageSize);

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res: any = await axiosInstance.get("/leaves/my");
      setLeaves(res.data || []);
    } catch {
      toast.error("Failed to load your leaves");
    } finally {
      setLoading(false);
    }
  };

  // start matra = single day; range cha bhane inclusive days
  const dayCount = !form.startDate
    ? 0
    : !form.endDate
      ? 1
      : form.endDate > form.startDate
        ? Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1
        : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate) {
      toast.error("Please select a start date (start date only = 1 day leave)");
      return;
    }
    if (form.endDate && form.endDate <= form.startDate) {
      toast.error("End date must be after the start date");
      return;
    }
    try {
      setSubmitting(true);
      // single-day (end khali) bhaye backend lai endDate = startDate pathaune
      const res = (await axiosInstance.post("/leaves", {
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        reason: form.reason,
      })) as any;
      const leaveId = res?.data?._id;

      // attachment upload garne (leave id chaina chaina)
      if (attachmentFile && leaveId) {
        const fd = new FormData();
        fd.append("attachment", attachmentFile);
        await axiosInstance.post(`/leaves/${leaveId}/attachment`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      toast.success("Leave request submitted");
      setShowForm(false);
      setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
      setAttachmentFile(null);
      fetchLeaves();
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => ({
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-secondary text-primary",
    rejected: "bg-red-100 text-red-700",
  }[status] || "bg-slate-100 text-slate-600");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">My Leaves</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-lg shadow-primary/20">
          <Plus size={14} /> Request
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : leaves.length === 0 ? (
        <div className="rounded-2xl bg-white border border-border p-10 text-center">
          <Plane size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">No leave requests yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
          {pagedLeaves.map((l) => (
            <div key={l._id} className="rounded-2xl bg-white border border-border p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize bg-slate-100 text-slate-600">{l.leaveType}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusBadge(l.status)}`}>{l.status}</span>
              </div>
              <p className="text-sm font-medium text-slate-800">
                {formatDate(new Date(l.startDate), calPref)}
                {l.startDate !== l.endDate && ` - ${formatDate(new Date(l.endDate), calPref)}`}
              </p>
              <p className="text-xs text-slate-500 mt-1">{l.reason}</p>
              {l.attachment && (
                <a
                  href={`${import.meta.env.VITE_APP_BASE_URL || ""}${l.attachment.startsWith("http") ? "" : l.attachment}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-primary hover:text-primary font-medium"
                >
                  <Paperclip size={12} />
                  View attachment
                </a>
              )}
              {l.reviewReason && <p className="text-[11px] text-slate-400 mt-1 italic">Remark: {l.reviewReason}</p>}
            </div>
          ))}
        </div>
        {leaves.length > 0 && (
          <Pagination page={page} pageSize={pageSize} total={leaves.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemName="requests" />
        )}
        </>
      )}

      {/* request form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Request Leave</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Leave type</label>
              <select value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary capitalize">
                {LEAVE_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>

            <div>
              <BSCalendarRange
                startDate={form.startDate ? new Date(form.startDate) : null}
                endDate={form.endDate ? new Date(form.endDate) : null}
                startLabel="Start Date"
                endLabel="End Date"
                allowSameDay={false}
                onChange={(start, end) => {
                  setForm({
                    ...form,
                    startDate: start ? toLocalDateInput(start) : "",
                    endDate: end ? toLocalDateInput(end) : "",
                  });
                }}
              />
              {dayCount > 0 ? (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  {dayCount} day{dayCount > 1 ? "s" : ""} selected{!form.endDate ? " (single day)" : ""}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1.5">Pick start date first — leave end empty for 1 day leave</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <textarea required minLength={5} rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" placeholder="Why do you need leave?" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Attachment (optional)</label>
              <label className="flex items-center gap-2 w-full border border-dashed border-border rounded-xl px-4 py-3 text-sm text-slate-500 cursor-pointer hover:border-primary hover:text-primary transition-colors">
                <Upload size={16} />
                <span>{attachmentFile ? attachmentFile.name : "Choose file (PDF, image, etc.)"}</span>
                <input type="file" className="hidden" onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
