import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Navigation, Crosshair, Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import GeofenceMap from "./GeofenceMap";
import { toastSingleApiError } from "../../lib/apiErrors";

type EntityType = "department" | "designation" | "branch";

const TITLES: Record<EntityType, string> = {
  department: "Department",
  designation: "Designation",
  branch: "Branch",
};

const ENDPOINTS: Record<EntityType, string> = {
  department: "/departments",
  designation: "/designations",
  branch: "/branches",
};

export interface EntityCreateData {
  name: string;
  code?: string;
  description?: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadius?: number;
  branch?: string;
  department?: string;
  departments?: Array<{ name: string; code: string; designations: string }>;
}

interface IOption {
  _id: string;
  name: string;
}

interface EntityCreateModalProps {
  entity: EntityType;
  open: boolean;
  onClose: () => void;
  onCreated: (createdId?: string) => void;
  initial?: EntityCreateData | null;
  editId?: string | null;
  // naya dept/designation create huda selected branch/department link garne
  extraPayload?: Record<string, string | undefined>;
}

// sabai entity (dept/designation/branch) ko lagi eklo shared create/edit modal
export default function EntityCreateModal({
  entity,
  open,
  onClose,
  onCreated,
  initial = null,
  editId = null,
  extraPayload,
}: EntityCreateModalProps) {
  const [form, setForm] = useState<EntityCreateData>(() => ({
    name: initial?.name || "",
    code: initial?.code || "",
    description: initial?.description || "",
    address: initial?.address || "",
    phone: (initial?.phone || "").replace(/\D/g, ""),
    latitude: initial?.latitude || 0,
    longitude: initial?.longitude || 0,
    geofenceRadius: initial?.geofenceRadius || 20,
    branch: initial?.branch || extraPayload?.branch || "",
    department: initial?.department || extraPayload?.department || "",
    departments: [],
  }));
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<IOption[]>([]);
  const [departments, setDepartments] = useState<IOption[]>([]);
  // radius input lai text-like controlled rakhnu (khali gareko bela 20 ma na phirne hami)
  const [radiusInput, setRadiusInput] = useState<string>(String(initial?.geofenceRadius || 20));

  // department/designation create/edit garda branch dropdown ko lagi
  useEffect(() => {
    if (entity !== "department" && entity !== "designation") return;
    let active = true;
    void (async () => {
      try {
        const res = (await axiosInstance.get("/branches")) as { data: IOption[] };
        if (active) setBranches(res.data || []);
      } catch {
        toast.error("Failed to fetch branches");
      }
    })();
    return () => {
      active = false;
    };
  }, [entity]);

  // designation garda branch anusar department options
  useEffect(() => {
    if (entity !== "designation" || !form.branch) return;
    let active = true;
    void (async () => {
      try {
        const res = (await axiosInstance.get("/departments", {
          params: { branch: form.branch },
        })) as { data: IOption[] };
        if (active) setDepartments(res.data || []);
      } catch {
        toast.error("Failed to fetch departments");
      }
    })();
    return () => {
      active = false;
    };
  }, [entity, form.branch]);

  if (!open) return null;

  const handleLocationChange = (lat: number, lng: number) => {
    setForm((f) => ({ ...f, latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) }));
  };

  // radius input: number matra accept garne (kossa pani text/alphabets allowed chaina)
  const handleRadiusChange = (raw: string) => {
    // non-digit sabai hataucha - paste/typing bhayeni number matra bascha
    const digits = raw.replace(/\D/g, "");
    setRadiusInput(digits);
    // khali chaina bhane matra form ma sync (hiyo map ko circle bujheko)
    if (digits === "") return;
    const num = Number(digits);
    const clamped = Math.min(1000, Math.max(10, num));
    setForm((f) => ({ ...f, geofenceRadius: clamped }));
  };

  // phone: number matra accept garne (text/alphabets allowed chaina)
  const handlePhoneChange = (raw: string) => {
    setForm((f) => ({ ...f, phone: raw.replace(/\D/g, "") }));
  };

  // blur huda clean + clamp
  const handleRadiusBlur = () => {
    const num = Number(radiusInput);
    let final = Number.isNaN(num) || radiusInput === "" ? 20 : num;
    final = Math.min(1000, Math.max(10, Math.round(final)));
    setRadiusInput(String(final));
    setForm((f) => ({ ...f, geofenceRadius: final }));
  };

  const useMyLocation = () => {
    if (!window.isSecureContext) {
      toast.error("Location is blocked: this page is not served securely. Open the app via http://localhost:5173 (or use HTTPS) to use 'Use my location'.");
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => handleLocationChange(pos.coords.latitude, pos.coords.longitude),
      () => toast.error("Failed to get your location. Please allow location permission and retry."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleBranchChange = (b: string) => {
    setForm((f) => ({ ...f, branch: b, department: "" }));
    setDepartments([]);
  };

  const addDeptRow = () =>
    setForm((f) => ({
      ...f,
      departments: [...(f.departments || []), { name: "", code: "", designations: "" }],
    }));

  const updateDeptRow = (idx: number, patch: { name?: string; code?: string; designations?: string }) =>
    setForm((f) => ({
      ...f,
      departments: (f.departments || []).map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));

  const removeDeptRow = (idx: number) =>
    setForm((f) => ({
      ...f,
      departments: (f.departments || []).filter((_, i) => i !== idx),
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    // portal vayeni outer form (employee create) ko submit trigger nahos
    e.preventDefault();
    e.stopPropagation();

    if (entity === "branch" && !form.latitude && !form.longitude) {
      toast.error("Please set the branch location on the map");
      return;
    }
    if (entity === "department" && !form.branch) {
      toast.error("Please select a branch for this department");
      return;
    }
    if (entity === "designation" && (!form.branch || !form.department)) {
      toast.error("Please select a branch and department for this designation");
      return;
    }
    if (entity === "branch" && form.phone?.trim() && !/^[0-9]{7,15}$/.test(form.phone.trim())) {
      toast.error("Phone must contain numbers only (7-15 digits)");
      return;
    }

    // branch create garda declare gareko departments lai code bina jana nadiyeko
    if (entity === "branch" && !editId) {
      for (const row of form.departments || []) {
        if (row.name.trim() && !row.code.trim()) {
          toast.error("Every declared department needs a code");
          return;
        }
      }
    }

    const payload: Record<string, string | number> = { name: form.name.trim() };
    if (entity === "department" || entity === "branch") payload.code = form.code?.trim().toUpperCase() || "";
    if (entity === "branch") {
      payload.address = form.address?.trim() || "";
      const branchPhone = (form.phone || "").replace(/\D/g, "");
      if (branchPhone) payload.phone = branchPhone;
      payload.latitude = form.latitude || 0;
      payload.longitude = form.longitude || 0;
      payload.geofenceRadius = form.geofenceRadius || 20;
    } else if (form.description?.trim()) {
      payload.description = form.description.trim();
    }

    // branch/department lai branch liyeko - create ma cascade, edit ma form select priority
    if (entity === "department" || entity === "designation") {
      payload.branch = ((!editId && extraPayload?.branch) || form.branch) || "";
    }
    if (entity === "designation") {
      payload.department = ((!editId && extraPayload?.department) || form.department) || "";
    }

    try {
      setSaving(true);

      // branch create + declared departments/designations ekaisath banane
      if (entity === "branch" && !editId && (form.departments || []).length > 0) {
        const branchRes = (await axiosInstance.post("/branches", payload)) as { data: { _id: string; name: string } };
        const branchId = branchRes.data?._id;
        if (!branchId) throw new Error("Branch not returned");
        let deptCount = 0;
        let desigCount = 0;
        for (const row of form.departments || []) {
          const dname = row.name.trim();
          if (!dname) continue;
          const deptRes = (await axiosInstance.post("/departments", {
            name: dname,
            code: (row.code || "").trim().toUpperCase(),
            branch: branchId,
          })) as { data: { _id: string; name: string } };
          deptCount++;
          const desigNames = (row.designations || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          for (const dn of desigNames) {
            await axiosInstance.post("/designations", {
              name: dn,
              branch: branchId,
              department: deptRes.data._id,
            });
            desigCount++;
          }
        }
        toast.success(
          `${branchRes.data?.name || "Branch"} added with ${deptCount} department${deptCount !== 1 ? "s" : ""}${
            desigCount ? ` and ${desigCount} designation${desigCount !== 1 ? "s" : ""}` : ""
          }`,
        );
        onClose();
        onCreated(branchId);
        return;
      }

      const res = (await axiosInstance[editId ? "put" : "post"](
        editId ? `${ENDPOINTS[entity]}/${editId}` : ENDPOINTS[entity],
        payload,
      )) as { data?: { _id: string; name: string } | null };
      toast.success(
        res?.data?.name ? `${res.data.name} ${editId ? "updated" : "added"}` : `${TITLES[entity]} ${editId ? "updated" : "added"}`,
      );
      onClose();
      onCreated(res?.data?._id || editId || undefined);
    } catch (error) {
      toastSingleApiError(error, `Failed to ${editId ? "update" : "add"} ${TITLES[entity].toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[70] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full my-8 max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-900">{editId ? "Edit" : "Add"} {TITLES[entity]}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" required />
            </div>
            {(entity === "department" || entity === "branch") && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary uppercase" required />
              </div>
            )}
          </div>

          {entity === "branch" ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" rows={2} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={15} placeholder="Numbers only" value={form.phone} onChange={(e) => handlePhoneChange(e.target.value)} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" />
                </div>
              </div>

              <div className="rounded-xl border border-secondary bg-secondary/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Navigation size={15} className="text-primary" /> Office Location & Geofence
                  </p>
                  <button type="button" onClick={useMyLocation} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-secondary text-xs font-medium text-primary hover:bg-secondary transition-colors">
                    <Crosshair size={13} /> Use my location
                  </button>
                </div>

                <GeofenceMap
                  latitude={form.latitude || 0}
                  longitude={form.longitude || 0}
                  radius={form.geofenceRadius || 20}
                  editable
                  onLocationChange={handleLocationChange}
                  onLocationSelect={(sel) => {
                    handleLocationChange(sel.latitude, sel.longitude);
                    setForm((f) => ({ ...f, address: sel.address }));
                  }}
                />
                <p className="text-[11px] text-slate-500">Search a place, click on the map, or drag the pin to set the branch location.</p>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
                    <input type="number" step="any" value={form.latitude || ""} onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} className="w-full border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
                    <input type="number" step="any" value={form.longitude || ""} onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} className="w-full border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Radius (m)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={radiusInput}
                      onChange={(e) => handleRadiusChange(e.target.value)}
                      onBlur={handleRadiusBlur}
                      placeholder="20"
                      className="w-full border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* branch create garda departments + designations declare garne (optional) */}
              {!editId && (
                <div className="rounded-xl border border-secondary bg-secondary/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Building2 size={15} className="text-primary" /> Departments for this branch
                    </p>
                    <button type="button" onClick={addDeptRow} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-secondary text-xs font-medium text-primary hover:bg-secondary transition-colors">
                      <Plus size={13} /> Add Department
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(form.departments || []).map((row, idx) => (
                      <div key={idx} className="rounded-xl bg-white border border-border p-3 space-y-2">
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => updateDeptRow(idx, { name: e.target.value })}
                            placeholder="Department name"
                            className="w-full border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
                          />
                          <input
                            type="text"
                            value={row.code}
                            onChange={(e) => updateDeptRow(idx, { code: e.target.value.toUpperCase() })}
                            placeholder="Code"
                            className="w-full border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary uppercase"
                          />
                          <button type="button" onClick={() => removeDeptRow(idx)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors" title="Remove department">
                            <X size={14} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={row.designations}
                          onChange={(e) => updateDeptRow(idx, { designations: e.target.value })}
                          placeholder="Designations — comma separated (e.g. Manager, Officer, Assistant)"
                          className="w-full border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
                        />
                      </div>
                    ))}

                    {(form.departments || []).length === 0 && (
                      <p className="text-[11px] text-slate-500">Optional: declare this branch's departments and designations while creating it.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {entity === "department" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
                  <select value={form.branch || ""} onChange={(e) => handleBranchChange(e.target.value)} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white" required>
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Which office does this department belong to?</p>
                </div>
              )}

              {entity === "designation" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
                    <select value={form.branch || ""} onChange={(e) => handleBranchChange(e.target.value)} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white" required>
                      <option value="">Select branch</option>
                      {branches.map((b) => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                    <select value={form.department || ""} disabled={!form.branch} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white disabled:bg-slate-50 disabled:text-slate-400" required>
                      <option value="">{form.branch ? "Select department" : "Select a branch first"}</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary" rows={3} />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-5 py-2.5 rounded-xl border border-border text-sm text-slate-600 hover:bg-secondary/30">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50">
              {saving ? "Saving..." : editId ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}