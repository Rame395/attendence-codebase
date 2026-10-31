import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Save, Building2, Clock, CalendarDays, Palette } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import { fetchCompanySettings } from "../../lib/reducers/companySetting-reducer";
import type { AppDispatch } from "../../config/store";
import { applyBrandColor, isValidBrandColor, DEFAULT_BRAND_COLOR } from "../../lib/hooks/useBrandTheme";

// company settings ko type - backend CompanySettingModel sanga match garne
interface ICompanySettings {
  companyName: string;
  workingStartTime: string;
  workingEndTime: string;
  lateGracePeriodMinutes: number;
  minimumWorkingMinutes: number;
  leaveCountsTowardAttendance: boolean;
  weeklyHolidays: string[];
  brandColor: string;
}

// brand presets - white text ma safe, pre-vetted colors
const BRAND_PRESETS = [
  { name: "Default Blue", value: "#28469E" },
  { name: "Emerald", value: "#0F766E" },
  { name: "Teal", value: "#0E7490" },
  { name: "Violet", value: "#7C3AED" },
  { name: "Pink", value: "#DB2777" },
  { name: "Crimson", value: "#DC2626" },
  { name: "Orange", value: "#EA580C" },
  { name: "Slate", value: "#334155" },
];

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// company settings page
export default function Settings() {
  const dispatch = useDispatch<AppDispatch>();
  const [settings, setSettings] = useState<ICompanySettings>({
    companyName: "",
    workingStartTime: "10:00",
    workingEndTime: "18:00",
    lateGracePeriodMinutes: 15,
    minimumWorkingMinutes: 240,
    leaveCountsTowardAttendance: true,
    weeklyHolidays: ["saturday"],
    brandColor: DEFAULT_BRAND_COLOR,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // server bata aayeko original values - change detect garna
  const [initialSettings, setInitialSettings] = useState<ICompanySettings | null>(null);

  // settings fetch garxa
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = (await axiosInstance.get("/company-settings")) as unknown as { data: Partial<ICompanySettings> | null };
        const data = res.data;
        if (data) {
          const loaded = {
            companyName: data.companyName || "",
            workingStartTime: data.workingStartTime || "10:00",
            workingEndTime: data.workingEndTime || "18:00",
            lateGracePeriodMinutes: data.lateGracePeriodMinutes || 15,
            minimumWorkingMinutes: data.minimumWorkingMinutes || 240,
            leaveCountsTowardAttendance: data.leaveCountsTowardAttendance ?? true,
            weeklyHolidays: data.weeklyHolidays || ["saturday"],
            brandColor: data.brandColor || DEFAULT_BRAND_COLOR,
          } as ICompanySettings;
          setSettings(loaded);
          setInitialSettings(loaded);
        }
      } catch {
        // silently fail - default empty values huncha
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // settings update garxa
  const handleSave = async () => {
    try {
      // brand color valid chaina bhane save rokne
      if (!isValidBrandColor(settings.brandColor)) {
        toast.error("Brand color must be a hex code like #28469E");
        return;
      }
      // office start/end time + minimum/grace validation
      if (!settings.workingStartTime.trim() || !settings.workingEndTime.trim()) {
        toast.error("Office start time and end time are required.");
        return;
      }
      if (settings.workingStartTime.trim() === settings.workingEndTime.trim()) {
        toast.error("Office start time and end time cannot be the same.");
        return;
      }
      if (!settings.lateGracePeriodMinutes) {
        toast.error("Late grace period is required.");
        return;
      }
      if (settings.lateGracePeriodMinutes <= 0) {
        toast.error("Late grace period must be greater than 0 minutes.");
        return;
      }
      if (!settings.minimumWorkingMinutes) {
        toast.error("Minimum working minutes is required.");
        return;
      }
      if (settings.minimumWorkingMinutes <= 0) {
        toast.error("Minimum working time must be greater than 0 minutes.");
        return;
      }
      setSaving(true);
      await axiosInstance.put("/company-settings", settings);
      dispatch(fetchCompanySettings()); // header/login page ma turuntai update huncha
      applyBrandColor(settings.brandColor); // theme turuntai lagu garne (reload chaina)
      setInitialSettings(settings);
      toast.success("Settings saved successfully");
    } catch (error) {
      const e = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e?.response?.data?.message || e?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // kei field change bhayo bhane matra floating save dekhaune
  const hasChanges = initialSettings
    ? JSON.stringify({ ...settings, weeklyHolidays: [...settings.weeklyHolidays].sort() }) !==
      JSON.stringify({ ...initialSettings, weeklyHolidays: [...initialSettings.weeklyHolidays].sort() })
    : false;

  // weekly holiday toggle garne
  const toggleHoliday = (day: string) => {
    setSettings((s) => ({
      ...s,
      weeklyHolidays: s.weeklyHolidays.includes(day)
        ? s.weeklyHolidays.filter((d) => d !== day)
        : [...s.weeklyHolidays, day],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Company Settings</h1>
        <p className="mt-1 text-slate-500">Configure attendance rules and working hours</p>
      </div>

      {/* company info */}
      <div className="bg-white rounded-2xl border border-border shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <Building2 size={18} className="text-primary" />
            </div>
            <h3 className="font-bold text-slate-800">Company Information</h3>
          </div>
        </div>
        <div className="p-6">
          <label htmlFor="settings-company-name" className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
          <input
            id="settings-company-name"
            type="text"
            maxLength={60}
            value={settings.companyName}
            onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
            placeholder="Enter company name"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <Palette size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Brand Color</h3>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* preset swatches */}
          <div className="flex flex-wrap gap-3" role="group" aria-label="Brand color presets">
            {BRAND_PRESETS.map((preset) => {
              const selected = settings.brandColor.toUpperCase() === preset.value.toUpperCase();
              return (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.name}
                  aria-label={`${preset.name} (${preset.value})`}
                  aria-pressed={selected}
                  onClick={() => {
                    setSettings((s) => ({ ...s, brandColor: preset.value }));
                    applyBrandColor(preset.value);
                  }}
                  className={`w-11 h-11 rounded-xl transition-all border-2 ${
                    selected
                      ? "border-slate-900 scale-110 shadow-md"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: preset.value }}
                />
              );
            })}
            {/* custom picker */}
            <label
              title="Custom color"
              className="w-11 h-11 rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-400 cursor-pointer flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all overflow-hidden relative"
            >
              <input
                type="color"
                aria-label="Custom brand color"
                value={isValidBrandColor(settings.brandColor) ? settings.brandColor : DEFAULT_BRAND_COLOR}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, brandColor: e.target.value.toUpperCase() }));
                  applyBrandColor(e.target.value);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <span className="text-xl font-bold leading-none">+</span>
            </label>
          </div>
          {/* hex input */}
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className="w-12 h-12 rounded-xl border border-border shadow-sm shrink-0"
              style={{ backgroundColor: isValidBrandColor(settings.brandColor) ? settings.brandColor : DEFAULT_BRAND_COLOR }}
            />
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="settings-brand-hex" className="block text-sm font-medium text-slate-700 mb-1">Hex code</label>
              <input
                id="settings-brand-hex"
                type="text"
                value={settings.brandColor}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  setSettings((s) => ({ ...s, brandColor: v }));
                  if (isValidBrandColor(v)) applyBrandColor(v);
                }}
                placeholder="#28469E"
                maxLength={7}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary font-mono uppercase"
              />
              {!isValidBrandColor(settings.brandColor) && (
                <p className="text-[11px] text-red-500 mt-1">Must be a hex code like #28469E</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* attendance rules */}
      <div className="bg-white rounded-2xl border border-border shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <Clock size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Attendance Rules</h3>
              <p className="text-xs text-slate-400">Office time, grace period and minimum hours</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-start-time" className="block text-sm font-medium text-slate-700 mb-1">Office start time</label>
              <input
                id="settings-start-time"
                type="time"
                value={settings.workingStartTime}
                onChange={(e) => setSettings({ ...settings, workingStartTime: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="settings-end-time" className="block text-sm font-medium text-slate-700 mb-1">Office end time</label>
              <input
                id="settings-end-time"
                type="time"
                value={settings.workingEndTime}
                onChange={(e) => setSettings({ ...settings, workingEndTime: e.target.value })}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="settings-grace-minutes" className="block text-sm font-medium text-slate-700 mb-1">Late grace period (minutes)</label>
              <input
                id="settings-grace-minutes"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={settings.lateGracePeriodMinutes || ""}
                onChange={(e) =>
                  setSettings({ ...settings, lateGracePeriodMinutes: Number(e.target.value.replace(/[^0-9]/g, "")) })
                }
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary [appearance:textfield]"
              />
              <p className="text-[11px] text-slate-400 mt-1">Check-in after office start + grace = Late</p>
            </div>
            <div>
              <label htmlFor="settings-min-working-minutes" className="block text-sm font-medium text-slate-700 mb-1">Minimum working minutes</label>
              <input
                id="settings-min-working-minutes"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={settings.minimumWorkingMinutes || ""}
                onChange={(e) =>
                  setSettings({ ...settings, minimumWorkingMinutes: Number(e.target.value.replace(/[^0-9]/g, "")) })
                }
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary [appearance:textfield]"
              />
              <p className="text-[11px] text-slate-400 mt-1">Working less than the minimum = Half Day</p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.leaveCountsTowardAttendance}
              onChange={(e) => setSettings({ ...settings, leaveCountsTowardAttendance: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-slate-700">Approved leave counts toward attendance rate</span>
          </label>
        </div>
      </div>

      {/* weekly holidays */}
      <div className="bg-white rounded-2xl border border-border shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <CalendarDays size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Weekly Holidays</h3>
              <p className="text-xs text-slate-400">Select non-working days of the week</p>
            </div>
          </div>
        </div>
        <div className="p-6 flex flex-wrap gap-2" role="group" aria-label="Weekly holidays">
          {DAYS.map((day) => {
            const active = settings.weeklyHolidays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                aria-label={`${day.charAt(0).toUpperCase() + day.slice(1)} weekly holiday`}
                onClick={() => toggleHoliday(day)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                  active ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating save - bottom right, only toggles when there are changes */}
      {(hasChanges || saving) && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 pl-4 pr-2 py-2 bg-slate-900 text-white rounded-2xl shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-4">
          <p className="text-xs font-medium text-slate-200 pl-1">You have unsaved changes</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:scale-[1.02] transition-all disabled:opacity-60 shrink-0"
          >
            <Save size={18} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
