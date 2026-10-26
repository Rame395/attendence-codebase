import { useEffect, useState } from "react";
import { Plus, Trash2, CalendarDays, X, Edit3, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import axiosInstance from "../../config/ApiClient";
import { formatDate, formatDateShort, toLocalDateInput } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import BSCalendarInput from "../../components/ui/BSCalendarInput";
import Pagination from "../../components/common/Pagination";

interface IEvent {
  _id: string;
  title: string;
  type: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  isForAllEmployees?: boolean;
  targetType?: string;
  branch?: { _id: string; name: string } | null;
  department?: { _id: string; name: string } | null;
  employee?: { _id: string; name: string } | null;
  roles?: string[];
  attachment?: { url: string; publicId?: string } | null;
}

// event types by color (holiday chhaina - holidays ko lagi dedicated Holidays page chha)
const EVENT_TYPES = [
  { value: "company_event", label: "Company Event", color: "bg-secondary text-primary" },
  { value: "staff_training", label: "Staff Training", color: "bg-secondary text-primary" },
  { value: "meeting", label: "Meeting", color: "bg-secondary text-primary" },
  { value: "other", label: "Other", color: "bg-slate-100 text-slate-600" },
];

const emptyForm = {
  title: "",
  type: "company_event",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
  description: "",
  isForAllEmployees: true,
  targetType: "all",
  branch: "",
  department: "",
  employee: "",
  roles: [] as string[],
};

// yo page le events dekhauxa ra manage garna dinxa (CRUD + reschedule)
export default function Events() {
  const calPref = useCalendarPreference();
  const [events, setEvents] = useState<IEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<IEvent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [branches, setBranches] = useState<{ _id: string; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedEvents = events.slice(start, start + pageSize);


  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get("/branches");
        setBranches((res.data as any[]) || []);
      } catch { /* silently fail */ }
    })();

  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res: any = await axiosInstance.get("/events");
      setEvents(res.data || []);
      setFetchError(false);
    } catch (exception) {
      // error toast nagarne - page ma retry banner dekhauxa
      const status = (exception as { response?: { status?: number } })?.response?.status;
      if (status !== 401) setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const openCreate = () => {
    setEditEvent(null);
    setForm(emptyForm);
    setAttachmentFile(null);
    setShowModal(true);
  };

  const openEdit = (ev: IEvent) => {
    setEditEvent(ev);
    setForm({
      title: ev.title,
      type: ev.type,
      date: ev.date ? ev.date.split("T")[0] : "",
      startTime: ev.startTime || "",
      endTime: ev.endTime || "",
      location: ev.location || "",
      description: ev.description || "",
      isForAllEmployees: ev.isForAllEmployees !== false,
      targetType: ev.targetType || "all",
      branch: ev.branch?._id || "",
      department: ev.department?._id || "",
      employee: ev.employee?._id || "",
      roles: ev.roles || [],
    });
    setAttachmentFile(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      let eventId: string | null = null;
      if (editEvent) {
        await axiosInstance.put(`/events/${editEvent._id}`, form);
        eventId = editEvent._id;
        toast.success("Event updated successfully");
      } else {
        const res = (await axiosInstance.post("/events", form)) as any;
        eventId = res?.data?._id;
        toast.success("Event created successfully");
      }

      // attachment upload garne
      if (attachmentFile && eventId) {
        const fd = new FormData();
        fd.append("attachment", attachmentFile);
        await axiosInstance.post(`/events/${eventId}/attachment`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setShowModal(false);
      setAttachmentFile(null);
      fetchEvents();
    } catch (err: any) {
      toast.error(err?.message || err?.response?.data?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await axiosInstance.delete(`/events/${deleteTarget._id}`);
      toast.success("Event deleted");
      setDeleteTarget(null);
      fetchEvents();
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setIsDeleting(false);
    }
  };

  const typeStyle = (type: string) => EVENT_TYPES.find((t) => t.value === type)?.color || EVENT_TYPES.find((t) => t.value === "other")!.color;
  const typeLabel = (type: string) => EVENT_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="mt-1 text-slate-500">Company events, trainings and meetings</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
        >
          <Plus size={18} /> Add Event
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading events...</div>
        ) : fetchError ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500 mb-3">Failed to fetch events. Please try again.</p>
            <button
              onClick={fetchEvents}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No events found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Event</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Type</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Time & Location</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedEvents.map((ev) => (
                  <tr key={ev._id} className="border-b border-slate-50 hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                          <CalendarDays size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{ev.title}</p>
                          {ev.description && <p className="text-[11px] text-slate-500 max-w-[240px] truncate">{ev.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${typeStyle(ev.type)}`}>
                        {typeLabel(ev.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{formatDate(new Date(ev.date), calPref)}</p>
                      <p className="text-[11px] text-slate-400">{formatDateShort(new Date(ev.date), calPref === "bs" ? "ad" : "bs")}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {ev.startTime && <p>{ev.startTime}{ev.endTime ? ` - ${ev.endTime}` : ""}</p>}
                      {ev.location && <p className="text-[11px] text-slate-400">{ev.location}</p>}
                      {!ev.isForAllEmployees && <p className="text-[11px] text-primary font-medium mt-1">{ev.branch?.name || "Branch scoped"}</p>}
                      {ev.attachment?.url && (
                        <a
                          href={`${import.meta.env.VITE_APP_BASE_URL || ""}${ev.attachment.url.startsWith("http") ? "" : ev.attachment.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1 text-[11px] text-primary hover:text-primary font-medium"
                        >
                          <Paperclip size={10} /> attachment
                        </a>
                      )}
                      {!ev.startTime && !ev.location && !ev.attachment && "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(ev)} className="p-2 rounded-xl text-amber-500 hover:bg-amber-50 transition-colors"><Edit3 size={15} /></button>
                        <button onClick={() => setDeleteTarget(ev)} className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !fetchError && events.length > 0 && (
          <Pagination page={page} pageSize={pageSize} total={events.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemName="events" />
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">{editEvent ? "Edit Event" : "Add Event"}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary">
                    {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <BSCalendarInput
                  value={form.date ? new Date(form.date) : null}
                  onChange={(d) => setForm({ ...form, date: d ? toLocalDateInput(d) : "" })}
                  label="Date"
                  placeholder="Select date"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start time</label>
                  <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End time</label>
                  <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" placeholder="e.g. Training Room" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" rows={3} />
              </div>

              {/* Branch scope */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Audience</p>
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={form.isForAllEmployees}
                    onChange={(e) => setForm({ ...form, isForAllEmployees: e.target.checked, branch: e.target.checked ? "" : form.branch })}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-700">All employees</span>
                </label>
                {!form.isForAllEmployees && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Branch (optional)</label>
                    <select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white">
                      <option value="">All branches</option>
                      {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Attachment upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Attachment (optional)</label>
                <label className="flex items-center gap-2 w-full border border-dashed border-border rounded-xl px-4 py-3 text-sm text-slate-500 cursor-pointer hover:border-primary hover:text-primary transition-colors">
                  <Upload size={16} />
                  <span>{attachmentFile ? attachmentFile.name : "Choose file"}</span>
                  <input type="file" className="hidden" onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-5 py-2.5 rounded-xl border border-border text-sm text-slate-600 hover:bg-secondary/30">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50">
                  {saving ? "Saving..." : editEvent ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        variant="danger"
        title="Delete event?"
        description="This event will be permanently removed from the company calendar."
        itemName={deleteTarget?.title}
        details={[
          "Attendees will no longer see this event",
          "Any attachment will be deleted with it",
        ]}
        confirmLabel="Delete event"
        isLoading={isDeleting}
      />
    </div>
  );
}
