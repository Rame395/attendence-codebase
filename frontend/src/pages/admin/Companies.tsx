import { useEffect, useState } from "react";
import {
  Plus, X, Factory, CheckCircle2, XCircle, Trash2, ImagePlus,
  ChevronLeft, ChevronRight, Pencil, Copy, Check, KeyRound, Building2, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { PERMISSION_KEYS, PERMISSION_LABELS, type PermissionKey } from "../../lib/permissions";
import { formatDate } from "../../lib/nepali-date";
import { useCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import { getProfileImageUrl } from "../../lib/profileImage";
import CompanyAvatar from "../../components/common/CompanyAvatar";

interface ICompany {
  _id: string;
  name: string;
  code: string;
  dbName: string;
  status: string;
  logo?: { url: string } | null;
  superAdmins?: number;
  directoryUsers?: number;
  createdAt: string;
}

interface ICompanyAdmin {
  _id: string;
  email: string;
  username?: string | null;
  status: string;
  permissions?: string[];
}

function isNotFound(error: any): boolean {
  return error?.status === 404 || error?.data?.message === "Company not found";
}

// backend error message nikalne - response object vs direct data
function apiErrorMessage(error: any, fallback: string): string {
  return error?.data?.message || error?.message || fallback;
}

// permission ticks editor - create + manage duitai ma reuse
function PermissionTicks({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const allTicked = PERMISSION_KEYS.every((key) => value.includes(key));
  const toggle = (key: string) => {
    onChange(value.includes(key) ? value.filter((p) => p !== key) : [...value, key]);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-600">Allowed functions (sidebar ticks)</p>
        <button
          type="button"
          onClick={() => onChange(allTicked ? [] : [...PERMISSION_KEYS])}
          className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1.5"
        >
          <span className={`size-4 rounded-md border-2 flex items-center justify-center shrink-0 ${allTicked ? "bg-primary border-primary text-white" : "border-slate-300 text-transparent"}`}>
            <svg viewBox="0 0 10 8" className="size-2.5 fill-none stroke-current" strokeWidth={2}><path d="M1 4l2.5 2.5L9 1" /></svg>
          </span>
          {allTicked ? "Deselect All" : "Select All"}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PERMISSION_KEYS.map((key) => {
          const on = value.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-medium text-left transition-all ${on ? "border-primary bg-secondary text-primary" : "border-border text-slate-500 hover:border-primary bg-white"}`}
            >
              <span className={`size-4 rounded-md border-2 flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary text-white" : "border-slate-300 text-transparent"}`}>
                <svg viewBox="0 0 10 8" className="size-2.5 fill-none stroke-current" strokeWidth={2}><path d="M1 4l2.5 2.5L9 1" /></svg>
              </span>
              {PERMISSION_LABELS[key as PermissionKey]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// company list table with pagination footer - row click le manage kholcha
function CompanyTable({
  companies,
  admins,
  page,
  pageSize,
  calPref,
  onPageChange,
  onPageSizeChange,
  onManage,
  onDeleteCompany,
}: {
  companies: ICompany[];
  admins: Record<string, ICompanyAdmin[]>;
  page: number;
  pageSize: number;
  calPref: Parameters<typeof formatDate>[1];
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
  onManage: (c: ICompany) => void;
  onDeleteCompany: (c: ICompany) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(companies.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const rows = companies.slice(start, start + pageSize);

  // page buttons - few pages bhaye sabai, dherai bhaye current around window
  const pageNums: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNums.push(i);
  } else {
    pageNums.push(1);
    if (safePage > 3) pageNums.push("…");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pageNums.push(i);
    if (safePage < totalPages - 2) pageNums.push("…");
    pageNums.push(totalPages);
  }

  return (
    <div className="rounded-2xl bg-white border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-semibold">Company</th>
              <th className="px-5 py-3 font-semibold">Super Admin</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Created</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((c) => {
              const admin = (admins[c._id] || [])[0];
              return (
                <tr key={c._id} onClick={() => onManage(c)} className="hover:bg-slate-50/60 transition-colors cursor-pointer">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CompanyAvatar name={c.name} logo={c.logo} size="sm" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{c.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{c.code} · {c.dbName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {admin ? (
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">
                          {admin.username || admin.email}
                          {admin.status !== "active" && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">Blocked</span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{admin.email} · {(admin.permissions || []).length} functions</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-600 font-medium">No super admin - click Manage to add</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${c.status === "active" ? "bg-secondary text-primary" : "bg-slate-100 text-slate-500"}`}>
                      {c.status === "active" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      <span className="capitalize">{c.status}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(new Date(c.createdAt), calPref)}
                  </td>
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onManage(c)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary text-primary text-xs font-bold hover:brightness-95 transition-all"
                        title="Manage company and super admin"
                      >
                        <Pencil size={13} /> Manage
                      </button>
                      <button
                        onClick={() => onDeleteCompany(c)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Delete company"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* footer - count + per-page selector + pagination (controls only when > 1 page) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-slate-400">
            Showing {companies.length === 0 ? 0 : start + 1}–{Math.min(start + pageSize, companies.length)} of {companies.length} companies
          </p>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Show
            <select
              value={pageSize}
              onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
              className="border border-border rounded-lg px-2 py-1 bg-white text-xs outline-none focus:border-primary"
            >
              {[5, 10, 15, 25, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            per page
          </label>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(safePage - 1)}
              disabled={safePage === 1}
              aria-label="Previous page"
              className="p-2 rounded-lg border border-border text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft size={14} />
            </button>
            {pageNums.map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-colors ${p === safePage ? "bg-primary text-white" : "border border-border text-slate-500 hover:border-primary hover:text-primary"}`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => onPageChange(safePage + 1)}
              disabled={safePage === totalPages}
              aria-label="Next page"
              className="p-2 rounded-lg border border-border text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// manage modal - company + super admin ekai thauma (tab le chhutyaune, view/edit hop pardaina)
function ManageCompanyModal({
  company,
  admin,
  calPref,
  onClose,
  onChanged,
}: {
  company: ICompany;
  admin: ICompanyAdmin | null;
  calPref: Parameters<typeof formatDate>[1];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"company" | "admin">(!admin ? "admin" : "company");

  // company tab state
  const [compName, setCompName] = useState(company.name);
  const [compStatus, setCompStatus] = useState(company.status);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  // admin tab state (existing)
  const [perms, setPerms] = useState<string[]>([...new Set(admin?.permissions || [])]);
  const [savingPerms, setSavingPerms] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);
  const [copied, setCopied] = useState(false);

  // admin tab state (create - admin chaina bhane)
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // change-email (replace) flow state
  const [showReplace, setShowReplace] = useState(false);
  const [repName, setRepName] = useState("");
  const [repEmail, setRepEmail] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [replacing, setReplacing] = useState(false);

  // remove access confirm
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  // parent refresh pachi fresh props aaucha - local form sync garne (key remount le company change handle garcha)
  useEffect(() => {
    setCompName(company.name);
    setCompStatus(company.status);
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(false);
  }, [company._id, company.name, company.status, company.logo]);
  useEffect(() => {
    setPerms([...new Set(admin?.permissions || [])]);
    setShowReplace(false);
    setRepName("");
    setRepEmail("");
  }, [admin?._id, admin?.email, JSON.stringify(admin?.permissions), admin?.status]);

  const currentLogo = logoPreview || (!removeLogo ? getProfileImageUrl(company.logo) : null);
  const permsDirty = JSON.stringify([...perms].sort()) !== JSON.stringify([...new Set(admin?.permissions || [])].sort());

  const handleLogoPick = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (f.size > 3 * 1024 * 1024) {
      toast.error("Logo must be under 3MB");
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
    setRemoveLogo(false);
  };

  const handleSaveCompany = async () => {
    if (!compName.trim()) {
      toast.error("Company name is required");
      return;
    }
    try {
      setSavingCompany(true);
      await axiosInstance.patch(`/companies/${company._id}`, { name: compName.trim(), status: compStatus });
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        try {
          await axiosInstance.post(`/companies/${company._id}/logo`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch {
          toast.error("Company saved, but logo upload failed");
        }
      } else if (removeLogo && company.logo) {
        try {
          await axiosInstance.delete(`/companies/${company._id}/logo`);
        } catch {
          toast.error("Logo remove failed");
        }
      }
      toast.success("Company updated successfully");
      await onChanged();
    } catch (error: any) {
      if (isNotFound(error)) {
        toast.info("This company was already removed. List refreshed.");
        onClose();
        await onChanged();
      } else {
        toast.error(apiErrorMessage(error, "Failed to save company"));
      }
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSavePerms = async () => {
    if (!admin || perms.length === 0) {
      toast.error("Tick at least one function for the super admin");
      return;
    }
    try {
      setSavingPerms(true);
      await axiosInstance.patch(`/companies/${company._id}/superadmins/${admin._id}`, { permissions: perms });
      toast.success("Super admin functions updated");
      await onChanged();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, "Failed to update functions"));
    } finally {
      setSavingPerms(false);
    }
  };

  const handleStatusToggle = async (next: string) => {
    if (!admin || next === admin.status || busyStatus) return;
    try {
      setBusyStatus(true);
      await axiosInstance.patch(`/companies/${company._id}/superadmins/${admin._id}`, { status: next });
      toast.success(next === "active" ? "Login access enabled" : "Login access blocked");
      await onChanged();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, "Failed to update login status"));
    } finally {
      setBusyStatus(false);
    }
  };

  const handleCopyEmail = async () => {
    if (!admin) return;
    try {
      await navigator.clipboard.writeText(admin.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy email");
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      toast.error("Super admin name and email are required");
      return;
    }
    if (newPerms.length === 0) {
      toast.error("Tick at least one function for the super admin");
      return;
    }
    try {
      setCreating(true);
      const saRes = (await axiosInstance.post(`/companies/${company._id}/superadmins`, {
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        permissions: newPerms,
      })) as { data?: { emailSent?: boolean; temporaryPassword?: string | null } };
      const tempPw = saRes?.data?.temporaryPassword ? ` Temporary password: ${saRes.data.temporaryPassword}` : "";
      if (saRes?.data?.emailSent === false) {
        toast.error(`Super admin created, but login email failed. Check mail settings.${tempPw}`);
      } else {
        toast.success("Super admin created. Temporary password sent to email.");
      }
      setNewName("");
      setNewEmail("");
      setNewPerms([]);
      await onChanged();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, "Super admin create failed"));
    } finally {
      setCreating(false);
    }
  };

  // change email = purano hataune + naya banaune (backend ma email update chaina - login nai naya huncha)
  const handleConfirmReplace = async () => {
    if (!admin) return;
    const cleanEmail = repEmail.trim().toLowerCase();
    if (!repName.trim() || !cleanEmail) {
      toast.error("New name and new email are required");
      return;
    }
    if (cleanEmail === admin.email.toLowerCase()) {
      toast.error("This is already the current email - type a different one");
      return;
    }
    try {
      setReplacing(true);
      await axiosInstance.delete(`/companies/${company._id}/superadmins/${admin._id}`);
      try {
        const saRes = (await axiosInstance.post(`/companies/${company._id}/superadmins`, {
          name: repName.trim(),
          email: cleanEmail,
          permissions: [...new Set(admin.permissions || [])].length > 0 ? [...new Set(admin.permissions || [])] : [...PERMISSION_KEYS],
        })) as { data?: { emailSent?: boolean; temporaryPassword?: string | null } };
        const tempPw = saRes?.data?.temporaryPassword ? ` Temporary password: ${saRes.data.temporaryPassword}` : "";
        if (saRes?.data?.emailSent === false) {
          toast.error(`Email changed, but login email failed. Check mail settings.${tempPw}`);
        } else {
          toast.success(`Super admin email changed to ${cleanEmail}. New temporary password sent there.`);
        }
      } catch (error: any) {
        toast.error(`${apiErrorMessage(error, "Old login removed, but new one failed")}. Add a new super admin manually.`);
      }
      setConfirmReplace(false);
      setShowReplace(false);
      setRepName("");
      setRepEmail("");
      await onChanged();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, "Failed to change email"));
    } finally {
      setReplacing(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!admin) return;
    try {
      setRemoving(true);
      await axiosInstance.delete(`/companies/${company._id}/superadmins/${admin._id}`);
      toast.success("Super admin login removed. You can add a new one below.");
      setConfirmRemove(false);
      await onChanged();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, "Failed to remove super admin"));
    } finally {
      setRemoving(false);
    }
  };

  const adminLetter = (admin?.username || admin?.email || "S").trim().charAt(0).toUpperCase();

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
        <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {/* header */}
          <div className="flex items-center gap-3 p-6 pb-0">
            <CompanyAvatar name={company.name} logo={company.logo} size="sm" />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-lg text-slate-900 truncate">{company.name}</h3>
              <p className="text-xs text-slate-400 font-mono">{company.code}</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 shrink-0"><X size={18} /></button>
          </div>

          {/* tabs */}
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100">
              <button
                type="button"
                onClick={() => setTab("company")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${tab === "company" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Building2 size={14} /> Company
              </button>
              <button
                type="button"
                onClick={() => setTab("admin")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${tab === "admin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <ShieldCheck size={14} /> Super admin
                {!admin && <span className="w-2 h-2 rounded-full bg-amber-500" title="Missing" />}
              </button>
            </div>
          </div>

          {tab === "company" ? (
            <div className="p-6 space-y-4">
              {/* logo picker */}
              <div className="flex items-center gap-4">
                <CompanyAvatar
                  name={compName || company.name || "C"}
                  logo={logoPreview || (!removeLogo ? company.logo : null)}
                  size="md"
                  rounded="rounded-2xl"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">Company logo</p>
                  <div className="flex gap-2 mt-1.5">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-slate-600 cursor-pointer hover:border-primary hover:text-primary transition-colors">
                      <ImagePlus size={13} />
                      {currentLogo ? "Change" : "Upload"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoPick(e.target.files?.[0] || null)} />
                    </label>
                    {currentLogo && (
                      <button
                        type="button"
                        onClick={() => { setLogoFile(null); if (logoPreview) URL.revokeObjectURL(logoPreview); setLogoPreview(null); setRemoveLogo(true); }}
                        className="px-3 py-1.5 rounded-xl border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company name</label>
                <input
                  type="text"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                  placeholder="e.g. Acme Pvt. Ltd."
                  minLength={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Code <span className="text-slate-400 font-normal">(fixed)</span></label>
                  <input
                    type="text"
                    value={company.code}
                    disabled
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none font-mono bg-slate-50 text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={compStatus} onChange={(e) => setCompStatus(e.target.value)} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive (blocks that company login)</option>
                  </select>
                </div>
              </div>

              <dl className="rounded-2xl border border-border divide-y divide-slate-100 text-sm">
                <div className="flex justify-between gap-3 px-4 py-2.5">
                  <dt className="text-slate-400">Database</dt>
                  <dd className="font-mono text-xs text-slate-700">{company.dbName}</dd>
                </div>
                <div className="flex justify-between gap-3 px-4 py-2.5">
                  <dt className="text-slate-400">Indexed logins</dt>
                  <dd className="text-slate-700 font-semibold">{company.directoryUsers ?? 0} emails in directory</dd>
                </div>
                <div className="flex justify-between gap-3 px-4 py-2.5">
                  <dt className="text-slate-400">Created</dt>
                  <dd className="text-slate-700">{formatDate(new Date(company.createdAt), calPref)}</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={handleSaveCompany}
                disabled={savingCompany}
                className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50"
              >
                {savingCompany ? "Saving..." : "Save Company"}
              </button>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {admin ? (
                <>
                  {/* identity card */}
                  <div className="rounded-2xl border border-border p-4 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-secondary text-primary flex items-center justify-center font-bold text-xl shrink-0">
                        {adminLetter}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">{admin.username || "Super admin"}</p>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-xs text-slate-500 truncate">{admin.email}</p>
                          <button
                            type="button"
                            onClick={handleCopyEmail}
                            title="Copy email"
                            className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-secondary transition-colors shrink-0"
                          >
                            {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${admin.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                        {admin.status === "active" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        <span className="capitalize">{admin.status}</span>
                      </span>
                    </div>

                    {/* login on/off - turuntai lagu huncha */}
                    <div className="mt-3 grid grid-cols-2 gap-1 p-1 rounded-xl bg-white border border-border">
                      {(["active", "inactive"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busyStatus}
                          onClick={() => handleStatusToggle(s)}
                          className={`py-1.5 rounded-lg text-xs font-bold capitalize transition-all disabled:opacity-50 ${admin.status === s ? (s === "active" ? "bg-green-600 text-white shadow-sm" : "bg-slate-500 text-white shadow-sm") : "text-slate-500 hover:text-slate-700"}`}
                        >
                          {s === "active" ? "Login enabled" : "Blocked"}
                        </button>
                      ))}
                    </div>

                  
                  </div>

                  {/* functions editor */}
                  <div className="rounded-2xl border border-border p-4 space-y-3">
                    <PermissionTicks value={perms} onChange={setPerms} />
                    <button
                      type="button"
                      onClick={handleSavePerms}
                      disabled={!permsDirty || savingPerms}
                      className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-40"
                    >
                      {savingPerms ? "Saving..." : permsDirty ? "Save Functions" : "No changes"}
                    </button>
                  </div>

                  {/* change email */}
                  <div className="rounded-2xl border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => { setShowReplace((s) => !s); setRepName(admin.username || ""); setRepEmail(""); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <span className="w-9 h-9 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0">
                        <KeyRound size={16} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-slate-800">Change login email</span>
                        <span className="block text-[11px] text-slate-400">Move this login to a new email address</span>
                      </span>
                      <ChevronRight size={16} className={`text-slate-400 transition-transform ${showReplace ? "rotate-90" : ""}`} />
                    </button>
                    {showReplace && (
                      <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          The current email <span className="font-semibold text-slate-700">{admin.email}</span> stops
                          working immediately. A fresh temporary password goes to the new address, and the same
                          functions are carried over.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
                            <input
                              type="text"
                              value={repName}
                              onChange={(e) => setRepName(e.target.value)}
                              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white"
                              placeholder="e.g. Ram Sharma"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">New email (login)</label>
                            <input
                              type="email"
                              value={repEmail}
                              onChange={(e) => setRepEmail(e.target.value)}
                              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white"
                              placeholder="new-admin@company.com"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!repName.trim() || !repEmail.trim()) {
                              toast.error("New name and new email are required");
                              return;
                            }
                            if (repEmail.trim().toLowerCase() === admin.email.toLowerCase()) {
                              toast.error("This is already the current email - type a different one");
                              return;
                            }
                            setConfirmReplace(true);
                          }}
                          className="w-full py-2.5 rounded-xl border-2 border-primary text-primary text-xs font-bold hover:bg-secondary transition-colors"
                        >
                          Continue
                        </button>
                      </div>
                    )}
                  </div>

                  {/* danger */}
                  <div className="rounded-2xl border border-red-200 bg-red-50/40 px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">Remove access</p>
                      <p className="text-[11px] text-slate-500">Login stops immediately. You can add a new one after.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(true)}
                      className="shrink-0 px-3 py-2 rounded-xl border border-red-200 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors bg-white"
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                /* admin chaina - sidai yahi bata banaune */
                <form onSubmit={handleCreateAdmin} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">No super admin yet</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white"
                        placeholder="e.g. Ram Sharma"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email (login)</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white"
                        placeholder="admin@company.com"
                      />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-border">
                    <PermissionTicks value={newPerms} onChange={setNewPerms} />
                  </div>
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create Super Admin"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* change-email confirm - purano login janchha, naya banchha */}
      <ConfirmDialog
        open={confirmReplace}
        onClose={() => !replacing && setConfirmReplace(false)}
        onConfirm={handleConfirmReplace}
        variant="danger"
        title="Change login email?"
        itemName={repEmail.trim().toLowerCase() || undefined}
        details={[
          `${admin?.email} will stop working immediately.`,
          "A fresh temporary password will be emailed to the new address.",
          `Same ${(admin?.permissions || []).length} functions will be carried over.`,
        ]}
        confirmLabel="Change email"
        isLoading={replacing}
      />

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => !removing && setConfirmRemove(false)}
        onConfirm={handleConfirmRemove}
        variant="sensitive"
        title="Remove super admin?"
        description="This will remove their login access immediately. You can create a new one afterwards."
        itemName={admin ? `${admin.username || admin.email} (${admin.email})` : undefined}
        confirmLabel="Remove super admin"
        isLoading={removing}
      />
    </>
  );
}

// system owner companies manage - superadmin sangai banauna milcha
export default function Companies() {
  const calPref = useCalendarPreference();
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [admins, setAdmins] = useState<Record<string, ICompanyAdmin[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", code: "", status: "active" });
  const [createLogo, setCreateLogo] = useState<File | null>(null);
  const [createPreview, setCreatePreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  // create modal ko superadmin
  const [saForm, setSaForm] = useState({ name: "", email: "", permissions: [] as string[] });
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState<ICompany | null>(null);
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const fetchAdmins = async (list: ICompany[]) => {
    // harek company ko superadmin (yeauta matra huncha)
    const entries = await Promise.all(
      list.map(async (c) => {
        try {
          const r = (await axiosInstance.get(`/companies/${c._id}/superadmins`)) as { data: ICompanyAdmin[] };
          return [c._id, r.data || []] as const;
        } catch {
          return [c._id, []] as const;
        }
      })
    );
    setAdmins(Object.fromEntries(entries));
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const res = (await axiosInstance.get("/companies")) as { data: ICompany[] };
      const list = res.data || [];
      setCompanies(list);
      setPage(1);
      await fetchAdmins(list);
    } catch {
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  // modal vitra ko save pachi - page reset nagarne refresh
  const refreshAll = async () => {
    try {
      const res = (await axiosInstance.get("/companies")) as { data: ICompany[] };
      const list = res.data || [];
      setCompanies(list);
      await fetchAdmins(list);
    } catch {
      toast.error("Failed to refresh");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // create logo preview cleanup
  useEffect(() => {
    return () => {
      if (createPreview) URL.revokeObjectURL(createPreview);
    };
  }, [createPreview]);

  const openCreate = () => {
    setCreateForm({ name: "", code: "", status: "active" });
    setCreateLogo(null);
    if (createPreview) URL.revokeObjectURL(createPreview);
    setCreatePreview(null);
    setSaForm({ name: "", email: "", permissions: [] });
    setShowCreate(true);
  };

  const handleCreateLogoPick = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (f.size > 3 * 1024 * 1024) {
      toast.error("Logo must be under 3MB");
      return;
    }
    if (createPreview) URL.revokeObjectURL(createPreview);
    setCreateLogo(f);
    setCreatePreview(URL.createObjectURL(f));
  };

  // logo upload - local uploads folder ma save huncha
  const uploadLogoFile = async (companyId: string, file: File): Promise<void> => {
    const fd = new FormData();
    fd.append("logo", file);
    await axiosInstance.post(`/companies/${companyId}/logo`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.code.trim()) {
      toast.error("Company name and code are required");
      return;
    }
    // CREATE mandatory: logo + superadmin; password mail ma jancha
    if (!createLogo) {
      toast.error("Company logo is required");
      return;
    }
    if (!saForm.name.trim() || !saForm.email.trim()) {
      toast.error("Super admin name and email are required");
      return;
    }
    if (saForm.permissions.length === 0) {
      toast.error("Tick at least one function for the super admin");
      return;
    }
    try {
      setCreating(true);
      const res = (await axiosInstance.post("/companies", {
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        status: createForm.status,
        superadmin: {
          name: saForm.name.trim(),
          email: saForm.email.trim().toLowerCase(),
          permissions: saForm.permissions,
        },
      })) as { data: { company: ICompany; emailSent?: boolean; temporaryPassword?: string | null } };
      const companyId = res.data.company._id;
      const tempPw = res.data.temporaryPassword ? ` Temporary password: ${res.data.temporaryPassword}` : "";
      // logo save (create ma mandatory - fail bhaye matra rollback)
      setUploadingLogo(true);
      try {
        await uploadLogoFile(companyId, createLogo);
      } catch {
        try {
          await axiosInstance.delete(`/companies/${companyId}`);
        } catch {
          // rollback fail - admin le manually delete garna sakcha
        }
        toast.error("Logo upload failed - company creation rolled back. Please retry.");
        return;
      } finally {
        setUploadingLogo(false);
      }
      if (res.data.emailSent) {
        toast.success("Company and super admin created. Temporary password sent to email. They must change the password on first login.");
      } else {
        toast.error(`Company and super admin created, but login email failed. Check mail settings.${tempPw}`);
      }
      setShowCreate(false);
      loadAll();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, "Failed to save company"));
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmDeleteCompany = async () => {
    if (!deleteCompanyTarget) return;
    try {
      setIsDeletingCompany(true);
      await axiosInstance.delete(`/companies/${deleteCompanyTarget._id}`);
      toast.success("Company deleted successfully");
      setDeleteCompanyTarget(null);
      refreshAll();
    } catch (error: any) {
      if (isNotFound(error)) {
        toast.info("This company was already removed. List refreshed.");
        setDeleteCompanyTarget(null);
        refreshAll();
      } else {
        toast.error(apiErrorMessage(error, "Failed to delete company"));
      }
    } finally {
      setIsDeletingCompany(false);
    }
  };

  const manageCompany = companies.find((c) => c._id === manageId) ?? null;
  const manageAdmin = (manageId ? admins[manageId]?.[0] : null) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="mt-1 text-slate-500">Manage companies, logos and super admin access - click any row to manage</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-lg shadow-primary/20">
          <Plus size={14} /> New Company
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : companies.length === 0 ? (
        <div className="rounded-2xl bg-white border border-border p-10 text-center">
          <Factory size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">Register your first company</p>
          <p className="text-xs text-slate-400 mt-1">Fill company details + super admin login - credentials go to that email.<br />Logging in with that email and password makes them the super admin.</p>
          <button onClick={openCreate} className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold shadow-lg shadow-primary/20">
            <Plus size={14} /> Register New Company
          </button>
        </div>
      ) : (
        <CompanyTable
          companies={companies}
          admins={admins}
          page={page}
          pageSize={pageSize}
          calPref={calPref}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onManage={(c) => setManageId(c._id)}
          onDeleteCompany={setDeleteCompanyTarget}
        />
      )}

      {/* create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-6 space-y-4 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">New Company</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>

            {/* logo picker */}
            <div className="flex items-center gap-4">
              <CompanyAvatar
                name={createForm.name || "C"}
                logo={createPreview}
                size="md"
                rounded="rounded-2xl"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">Company logo <span className="text-red-500">*</span></p>
                <div className="flex gap-2 mt-1.5">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-slate-600 cursor-pointer hover:border-primary hover:text-primary transition-colors">
                    <ImagePlus size={13} />
                    {createPreview ? "Change" : "Upload"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCreateLogoPick(e.target.files?.[0] || null)} />
                  </label>
                  {createPreview && (
                    <button
                      type="button"
                      onClick={() => { setCreateLogo(null); URL.revokeObjectURL(createPreview); setCreatePreview(null); }}
                      className="px-3 py-1.5 rounded-xl border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="e.g. Acme Pvt. Ltd."
                required
                minLength={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary font-mono"
                  placeholder="e.g. ACME"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={createForm.status} onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive (blocks that company login)</option>
                </select>
              </div>
            </div>

            {/* superadmin section - create ma required */}
            <div className="rounded-2xl border border-border p-4 space-y-3 bg-slate-50/50">
              <div>
                <p className="text-sm font-bold text-slate-800">Super admin (required)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
                  <input type="text" value={saForm.name} onChange={(e) => setSaForm({ ...saForm, name: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white" placeholder="e.g. Ram Sharma" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email (login)</label>
                  <input type="email" value={saForm.email} onChange={(e) => setSaForm({ ...saForm, email: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white" placeholder="admin@company.com" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-border">
                <PermissionTicks value={saForm.permissions} onChange={(permissions) => setSaForm({ ...saForm, permissions })} />
              </div>
            </div>

            <button type="submit" disabled={creating || uploadingLogo} className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">
              {creating || uploadingLogo ? "Saving..." : "Create Company"}
            </button>
          </form>
        </div>
      )}

      {/* manage modal - company + super admin ekai thauma */}
      {manageCompany && (
        <ManageCompanyModal
          key={manageCompany._id}
          company={manageCompany}
          admin={manageAdmin}
          calPref={calPref}
          onClose={() => setManageId(null)}
          onChanged={refreshAll}
        />
      )}

      <ConfirmDialog
        open={!!deleteCompanyTarget}
        onClose={() => !isDeletingCompany && setDeleteCompanyTarget(null)}
        onConfirm={handleConfirmDeleteCompany}
        variant="sensitive"
        title="Delete company?"
        description="This will permanently remove the company, its super admin and ALL its data. This action cannot be undone."
        itemName={deleteCompanyTarget ? `${deleteCompanyTarget.name} (${deleteCompanyTarget.code})` : undefined}
        confirmLabel="Delete company"
        isLoading={isDeletingCompany}
      />
    </div>
  );
}
