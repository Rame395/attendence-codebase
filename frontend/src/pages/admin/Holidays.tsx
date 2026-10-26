import { useEffect, useState } from "react";
import { Plus, Trash2, Edit3, CalendarDays, X, Building2, Globe2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import axiosInstance from "../../config/ApiClient";
import { addDays, formatDate, toLocalDateInput } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import BSCalendarInput from "../../components/ui/BSCalendarInput";
import Pagination from "../../components/common/Pagination";

interface IBranch {
  _id: string;
  name: string;
  code: string;
}

interface IHoliday {
  _id: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  appliesTo: "all" | "branch" | "department";
  branches?: ({ _id: string; name: string; code: string } | string)[];
  gender: "both" | "male" | "female";
}

interface IForm {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  everyone: boolean;
  branches: string[];
  gender: "both" | "male" | "female";
}

const emptyForm: IForm = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  everyone: true,
  branches: [],
  gender: "both",
};

const fmtDate = (d?: string | null, calPref: "bs" | "ad" = "bs") => {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "-" : formatDate(dt, calPref);
};

// date input le "YYYY-MM-DD" (local time) maagchha - ISO convert garda date shift hunna bhanera
const toDateInput = (d?: string | null) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

// holidays manage - all/branch + gender-specific
export default function Holidays() {
  const calPref = useCalendarPreference();
  const [holidays, setHolidays] = useState<IHoliday[]>([]);
  const [branches, setBranches] = useState<IBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editHoliday, setEditHoliday] = useState<IHoliday | null>(null);
  const [form, setForm] = useState<IForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IHoliday | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(holidays.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedHolidays = holidays.slice(start, start + pageSize);

  const fetchHolidays = async () => {
    const res = (await axiosInstance.get("/holidays")) as unknown as { data: IHoliday[] };
    setHolidays(res.data || []);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const holidayRes = (await axiosInstance.get("/holidays").catch(() => null)) as unknown as { data: IHoliday[] } | null;
        const branchRes = (await axiosInstance.get("/branches").catch(() => null)) as unknown as { data: IBranch[] } | null;
        if (!active) return;
        setHolidays(holidayRes?.data || []);
        setBranches(branchRes?.data || []);
      } catch {
        if (active) toast.error("Failed to fetch holidays");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openAdd = () => {
    setEditHoliday(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (h: IHoliday) => {
    setEditHoliday(h);
    setForm({
      title: h.title,
      description: h.description || "",
      startDate: toDateInput(h.startDate),
      endDate: toDateInput(h.endDate),
      everyone: h.appliesTo === "all",
      branches: (h.branches || []).map((b) => (typeof b === "string" ? b : b._id)),
      gender: h.gender,
    });
    setShowModal(true);
  };

  const toggleBranch = (id: string) => {
    setForm((f) => ({
      ...f,
      branches: f.branches.includes(id) ? f.branches.filter((v) => v !== id) : [...f.branches, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // end date khali = single-day; natra strictly pachi huna parcha
    if (!form.startDate) {
      toast.error("Please select a start date");
      return;
    }
    if (form.endDate && form.endDate <= form.startDate) {
      toast.error("End date must be after the start date (leave empty for single day)");
      return;
    }
    const endDate = form.endDate || form.startDate;

    // scope derive: everyone -> all company, natra selected branch haru lai matra
    let appliesTo: "all" | "branch" = "all";
    if (!form.everyone) {
      if (form.branches.length === 0) {
        toast.error("Select at least one branch");
        return;
      }
      appliesTo = "branch";
    }

    const payload = {
      title: form.title,
      description: form.description || undefined,
      startDate: form.startDate,
      endDate,
      appliesTo,
      branches: appliesTo === "branch" ? form.branches : [],
      gender: form.gender,
    };

    try {
      setSaving(true);
      if (editHoliday) {
        await axiosInstance.put(`/holidays/${editHoliday._id}`, payload);
        toast.success("Holiday updated successfully");
      } else {
        await axiosInstance.post("/holidays", payload);
        toast.success("Holiday created successfully");
      }
      setShowModal(false);
      setEditHoliday(null);
      setForm(emptyForm);
      await fetchHolidays();
    } catch (err) {
      toast.error((err as { message?: string })?.message || "Failed to save holiday");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await axiosInstance.delete(`/holidays/${deleteTarget._id}`);
      toast.success("Holiday deleted");
      setHolidays((list) => list.filter((h) => h._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete holiday");
    } finally {
      setIsDeleting(false);
    }
  };

  // list ma dekhauna ko lagi scope label banaune
  const scopeLabel = (h: IHoliday) => {
    if (h.appliesTo === "branch") {
      return (h.branches || []).map((b) => (typeof b === "string" ? b : b.name)).join(", ") || "Specific branches";
    }
    return "All staff";
  };

  const genderLabel = (g: IHoliday["gender"]) =>
    g === "male" ? "Male only" : g === "female" ? "Female only" : "Everyone";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Holidays</h1>
          <p className="mt-1 text-slate-500">Company holiday schedule and management</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
        >
          <Plus size={18} /> Add Holiday
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading holidays...</div>
        ) : holidays.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No holidays found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Holiday</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Dates</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Applies To</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Gender</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedHolidays.map((h) => (
                  <tr key={h._id} className="border-b border-slate-50 hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                          <CalendarDays size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{h.title}</p>
                          {h.description && <p className="text-xs text-slate-400 max-w-[260px] truncate">{h.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                      {fmtDate(h.startDate, calPref)}
                      {h.endDate && h.startDate !== h.endDate && ` — ${fmtDate(h.endDate, calPref)}`}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                        h.appliesTo === "all" ? "bg-secondary text-primary" : "bg-secondary text-primary"
                      }`}>
                        {h.appliesTo === "all" ? <Globe2 size={11} /> : <Building2 size={11} />}
                        {scopeLabel(h)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium ${
                        h.gender === "both" ? "bg-slate-100 text-slate-600" : "bg-pink-100 text-pink-700"
                      }`}>
                        {genderLabel(h.gender)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(h)} className="p-2 rounded-xl text-amber-500 hover:bg-amber-50 transition-colors" title="Edit holiday">
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(h)} className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors" title="Delete holiday">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && holidays.length > 0 && (
          <Pagination page={page} pageSize={pageSize} total={holidays.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemName="holidays" />
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">{editHoliday ? "Edit Holiday" : "Add Holiday"}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Dashain Holiday, Women's Day" className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <BSCalendarInput
                  value={form.startDate ? new Date(form.startDate) : null}
                  onChange={(d) => {
                    const s = d ? toLocalDateInput(d) : "";
                    // end start sanga same / aghi bhayo bhane clear (single-day = end khali)
                    setForm({
                      ...form,
                      startDate: s,
                      endDate: form.endDate && s && form.endDate <= s ? "" : form.endDate,
                    });
                  }}
                  label="Start Date"
                  placeholder="Select start"
                  max={form.endDate ? addDays(new Date(form.endDate), -1) : undefined}
                />
                <BSCalendarInput
                  value={form.endDate ? new Date(form.endDate) : null}
                  onChange={(d) => setForm({ ...form, endDate: d ? toLocalDateInput(d) : "" })}
                  label="End Date"
                  placeholder="Optional - single day"
                  min={form.startDate ? addDays(new Date(form.startDate), 1) : undefined}
                />
              </div>

              {/* who gets this holiday - simple checkbox */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.everyone}
                    onChange={(e) => setForm({ ...form, everyone: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-medium text-slate-700">Everyone (whole company)</span>
                </label>

                {!form.everyone && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1.5">Branches</p>
                    {branches.length === 0 ? (
                      <p className="text-xs text-slate-400">No branches found</p>
                    ) : (
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                        {branches.map((b) => (
                          <label key={b._id} className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={form.branches.includes(b._id)} onChange={() => toggleBranch(b._id)} className="w-4 h-4 accent-primary" />
                            <span className="text-sm text-slate-700">{b.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Gender</p>
                  <div className="flex gap-5">
                    {([
                      { value: "both", label: "Both" },
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                    ] as const).map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="holiday-gender"
                          checked={form.gender === value}
                          onChange={() => setForm({ ...form, gender: value })}
                          className="w-4 h-4 accent-primary"
                        />
                        <span className="text-sm text-slate-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" rows={2} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-5 py-2.5 rounded-xl border border-border text-sm text-slate-600 hover:bg-secondary/30">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50">
                  {saving ? "Saving..." : editHoliday ? "Update" : "Create"}
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
        title="Delete holiday?"
        description="This holiday will be removed from the company calendar."
        itemName={deleteTarget?.title}
        details={[
          "Attendance rules for this date will revert to normal working day",
          "Employees will be expected to check in unless another holiday covers the date",
        ]}
        confirmLabel="Delete holiday"
        isLoading={isDeleting}
      />
    </div>
  );
}
