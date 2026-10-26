import { useEffect, useState } from "react";
import { Plus, X, Wrench } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import { formatDate, formatTime, toLocalDateInput } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import BSCalendarInput from "../../components/ui/BSCalendarInput";
import Pagination from "../../components/common/Pagination";

interface ICorrection {
  _id: string;
  date: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  status: string;
  reviewReason?: string | null;
}

// attendance correction request page
export default function RequestCorrection() {
  const calPref = useCalendarPreference();
  const [requests, setRequests] = useState<ICorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ date: "", checkIn: "", checkOut: "", reason: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const totalPages = Math.max(1, Math.ceil(requests.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedRequests = requests.slice(start, start + pageSize);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res: any = await axiosInstance.get("/corrections/my");
      setRequests(res.data || []);
    } catch {
      toast.error("Failed to load correction requests");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);

      // date + time lai combine garera ISO banaune
      const payload: any = { date: form.date, reason: form.reason };
      if (form.checkIn) payload.requestedCheckIn = new Date(`${form.date}T${form.checkIn}`).toISOString();
      if (form.checkOut) payload.requestedCheckOut = new Date(`${form.date}T${form.checkOut}`).toISOString();

      await axiosInstance.post("/corrections", payload);
      toast.success("Correction request submitted");
      setShowForm(false);
      setForm({ date: "", checkIn: "", checkOut: "", reason: "" });
      fetchRequests();
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
        <h1 className="text-xl font-bold text-slate-900">Corrections</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-lg shadow-primary/20">
          <Plus size={14} /> New
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl bg-white border border-border p-10 text-center">
          <Wrench size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">No correction requests yet</p>
          <p className="text-[11px] text-slate-400 mt-1">Forgot to check in/out? Request a correction.</p>
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {pagedRequests.map((r) => (
            <div key={r._id} className="rounded-2xl bg-white border border-border p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-semibold text-slate-800">{formatDate(new Date(r.date), calPref)}</p>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusBadge(r.status)}`}>{r.status}</span>
              </div>
              <div className="text-xs text-slate-500 space-y-0.5">
                {r.requestedCheckIn && <p>Requested check-in: {formatTime(r.requestedCheckIn)}</p>}
                {r.requestedCheckOut && <p>Requested check-out: {formatTime(r.requestedCheckOut)}</p>}
              </div>
              <p className="text-xs text-slate-500 mt-1.5 italic">"{r.reason}"</p>
              {r.reviewReason && <p className="text-[11px] text-slate-400 mt-1">Remark: {r.reviewReason}</p>}
            </div>
          ))}
        </div>
        {requests.length > 0 && (
          <Pagination page={page} pageSize={pageSize} total={requests.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemName="requests" />
        )}
        </>
      )}

      {/* request form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Request Correction</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>

            <BSCalendarInput
              value={form.date ? new Date(form.date) : null}
              onChange={(d) => setForm({ ...form, date: d ? toLocalDateInput(d) : "" })}
              max={new Date()}
              label="Date"
              placeholder="Select date"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Correct check-in</label>
                <input type="time" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Correct check-out</label>
                <input type="time" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <textarea required minLength={5} rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" placeholder="e.g. Forgot to check in" />
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
