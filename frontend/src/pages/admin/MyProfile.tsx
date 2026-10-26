import { useEffect, useState } from "react";
import {
  User,
  Mail,
  Building2,
  BriefcaseBusiness,
  MapPin,
  Calendar,
  Save,
  Lock,
  Eye,
  EyeOff,
  Shield,
} from "lucide-react";
import { useAppSelector } from "../../lib/hooks/redux";
import { useDispatch } from "react-redux";
import axiosInstance from "../../config/ApiClient";
import Cookies from "js-cookie";
import GenderSelect from "../../components/common/GenderSelect";
import ProfileImageUpload from "../../components/common/ProfileImageUpload";
import { getProfileImageUrl, type IProfileImage } from "../../lib/profileImage";
import { formatDate } from "../../lib/nepali-date";
import { useCalendarPreference, setCalendarPreference } from "../../lib/hooks/useCalendarPreference";
import { refreshAuthUser } from "../../lib/reducers/auth-reducer";
import { toast } from "sonner";

// profile data ko type
interface ProfileData {
  _id: string;
  email: string;
  username?: string | null;
  role: string;
  status: string;
  createdAt?: string;
  calendarPreference?: "bs" | "ad";
  profileImage?: IProfileImage | null;
  employee?: {
    _id: string;
    employeeId: string;
    name: string;
    email: string;
    phone: string;
    gender?: string | null;
    profileImage?: IProfileImage | null;
    department?: { _id: string; name: string; code: string } | null;
    designation?: { _id: string; name: string } | null;
    branch?: { _id: string; name: string; code: string } | null;
    joiningDate?: string;
    status?: string;
  } | null;
}

// profile - editable fields + locked work info
export default function MyProfile() {
  const calPref = useCalendarPreference();
  const dispatch = useDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "",
    calendarPreference: "bs" as "bs" | "ad",
  });
  // server bata aayeko original values - no-change check ko lagi (ProfileData initialForm)
  const [initialForm, setInitialForm] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "",
    calendarPreference: "bs" as "bs" | "ad",
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  // photo upload - select garda instant preview + turuntai server ma upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // profile data server bata lincha
  const loadProfile = async () => {
    const res = await axiosInstance.get("/auth/me");
    return res.data as ProfileData & { status?: string };
  };

  // aayeko data lai state ma rakhne
  const applyProfile = (data: ProfileData & { status?: string }) => {
    setProfile({
      _id: data._id,
      email: data.email,
      username: data.username || null,
      role: data.role,
      status: data.status || "active",
      createdAt: data.createdAt,
      calendarPreference: data.calendarPreference || "bs",
      profileImage: data.profileImage || null,
      employee: data.employee || null,
    });
    // form prefill - employee record chaina bhane username (creation name) bata
    const prefilled = {
      name: data.employee?.name || data.username || "",
      email: data.email || "",
      phone: (data.employee?.phone || "").replace(/\D/g, ""),
      gender: data.employee?.gender || "",
      calendarPreference: (data.calendarPreference || "bs") as "bs" | "ad",
    };
    setForm(prefilled);
    setInitialForm(prefilled);
  };

  // retry / save pachi refresh garne
  const fetchProfile = async () => {
    try {
      applyProfile(await loadProfile());
    } catch (error) {
      const e = error as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || "Failed to fetch profile");
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await loadProfile();
        if (!active) return;
        applyProfile(data);
      } catch (error) {
        if (!active) return;
        // error bhayo bhane authUser bata fallback data
        if (authUser) {
          setProfile({
            _id: authUser.id,
            email: authUser.email,
            username: authUser.name || null,
            role: authUser.role,
            status: "active",
            calendarPreference: authUser.calendarPreference || "bs",
            profileImage: null,
            employee: null,
          });
          const fallbackForm = {
            name: authUser.name || "",
            email: authUser.email,
            phone: "",
            gender: "",
            calendarPreference: (authUser.calendarPreference || "bs") as "bs" | "ad",
          };
          setForm(fallbackForm);
          setInitialForm(fallbackForm);
        } else {
          const e = error as { response?: { data?: { message?: string } } };
          toast.error(e?.response?.data?.message || "Failed to fetch profile");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // profile fields server initial values sanga compare - enable/disable ko lagi
  const profileChanged =
    form.name.trim() !== (initialForm.name || "").trim() ||
    form.email.trim().toLowerCase() !== (initialForm.email || "").trim().toLowerCase() ||
    form.phone.trim() !== (initialForm.phone || "").trim() ||
    (form.gender || "") !== (initialForm.gender || "") ||
    (form.calendarPreference || "bs") !== (initialForm.calendarPreference || "bs");

  // password fields ma kei type bhayeko chha ki nahi
  const passwordPending =
    passwordData.currentPassword.trim() !== "" ||
    passwordData.newPassword.trim() !== "" ||
    passwordData.confirmPassword.trim() !== "";

  // kei pani change nabhaye samma Save button disabled rahanxa
  const hasPendingChanges = profileChanged || passwordPending;

  // profile + password sabai euta Save Changes button bata db ma save garxa
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (form.phone.trim() && !/^[0-9]{7,15}$/.test(form.phone.trim())) {
      toast.error("Phone must contain numbers only (7-15 digits)");
      return;
    }
    if (passwordPending) {
      if (!passwordData.currentPassword.trim()) {
        toast.error("Current password is required");
        return;
      }
      if (!passwordData.newPassword.trim()) {
        toast.error("New password is required");
        return;
      }
      if (passwordData.newPassword.length < 6) {
        toast.error("New password must be at least 6 characters");
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast.error("New passwords do not match");
        return;
      }
      if (passwordData.newPassword === passwordData.currentPassword) {
        toast.error("New password must be different from the current password");
        return;
      }
    }
    if (!profileChanged && !passwordPending) return;

    setSaving(true);
    try {
      if (profileChanged) {
        await axiosInstance.patch("/auth/profile", {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          gender: form.gender || undefined,
          calendarPreference: form.calendarPreference,
        });
        // calendar preference turuntai apply + redux/auth sync (reload nahos)
        setCalendarPreference(form.calendarPreference);
        dispatch(refreshAuthUser({ calendarPreference: form.calendarPreference }));
      }
      if (passwordPending) {
        const pwRes = (await axiosInstance.post("/auth/change-password", {
          currentPassword: passwordData.currentPassword.trim(),
          newPassword: passwordData.newPassword,
        })) as unknown as { data?: { accessToken?: string } };
        // password change le aru session logout garxa - fresh token save garne (natra afai logout huncha)
        if (pwRes?.data?.accessToken) {
          Cookies.set("access_token", pwRes.data.accessToken, {
            expires: 1,
            sameSite: "lax",
            secure: window.location.protocol === "https:",
          });
        }
      }
      toast.success(passwordPending ? "Profile and password updated successfully" : "Profile updated successfully");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPasswordForm(false);
      fetchProfile();
    } catch (error) {
      const e = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e?.response?.data?.message || e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const formatRole = (role: string) => {
    const map: Record<string, string> = {
      platform_admin: "Platform Admin",
      super_admin: "Super Admin",
      hr_admin: "HR / Admin",
      manager: "Manager",
      employee: "Employee",
    };
    return map[role] || role;
  };

  // photo select garda instant preview + turuntai upload (POST /auth/profile-image)
  const handleImageSelect = async (f: File | null) => {
    if (!f) return;
    setImageFile(f);
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("profileImage", f);
      const res = (await axiosInstance.post("/auth/profile-image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })) as unknown as { data?: ProfileData };
      toast.success("Profile photo updated");
      setImageFile(null);
      if (res?.data) applyProfile(res.data);
      else fetchProfile();
    } catch (error) {
      const e = error as { message?: string };
      toast.error(e?.message || "Failed to upload photo");
      setImageFile(null);
    } finally {
      setUploadingImage(false);
    }
  };

  // photo hataune (DELETE /auth/profile-image)
  const handleImageRemove = async () => {
    setUploadingImage(true);
    try {
      const res = (await axiosInstance.delete("/auth/profile-image")) as unknown as { data?: ProfileData };
      toast.success("Profile photo removed");
      if (res?.data) applyProfile(res.data);
      else fetchProfile();
    } catch (error) {
      const e = error as { message?: string };
      toast.error(e?.message || "Failed to remove photo");
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading profile...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-lg">Profile not found</p>
        <button onClick={fetchProfile} className="mt-3 px-4 py-2 rounded-xl bg-primary text-white text-sm">
          Retry
        </button>
      </div>
    );
  }

  const emp = profile.employee;
  // name nabhaye username (creation name), tyo pani nabhaye role label - email ko prefix kahilyai dekhaina
  const displayName = emp?.name || profile.username || formatRole(profile.role);
  // joining - employee record chaina bhane account creation date (super_admin ko join miti)
  const joiningValue = emp?.joiningDate || profile.createdAt || null;
  const displayId = emp?.employeeId || "SUPER-ADMIN";
  const isSuperAdminNoEmp = profile.role === "super_admin" && !emp;
  // employee record cha bhane employee photo, natra user photo (super_admin)
  const currentImage = emp?.profileImage || profile.profileImage || null;
  const headerImg = getProfileImageUrl(currentImage);

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="mt-1 text-slate-500">View and manage your profile information</p>
      </div>

      {/* Profile header card - photo preview sadhai dekhincha */}
      <div className="rounded-2xl bg-primary p-8 text-white shadow-lg shadow-primary/20">
        <div className="flex items-center gap-6">
          {headerImg ? (
            <img
              src={headerImg}
              alt={displayName}
              className="w-20 h-20 rounded-2xl object-cover ring-2 ring-white/40 shadow shrink-0 bg-white/20"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{displayName}</h2>
            <p className="text-secondary">{displayId}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-medium flex items-center gap-1.5">
                <Shield size={12} />
                {formatRole(profile.role)}
              </span>
              <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-medium capitalize">
                {emp?.status || profile.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Editable personal info */}
      <div className="rounded-2xl bg-white border border-border shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <User size={20} className="text-slate-600" />
            <div>
              <h3 className="font-bold text-slate-800">Personal Information</h3>
              <p className="text-xs text-slate-400">You can edit these details yourself</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Photo upload + instant preview */}
          <ProfileImageUpload
            name={displayName}
            currentImage={currentImage}
            file={imageFile}
            onChange={handleImageSelect}
            onRemove={currentImage || imageFile ? handleImageRemove : undefined}
            uploading={uploadingImage}
            size="lg"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              placeholder="Enter your full name"
              minLength={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              placeholder="Numbers only"
              minLength={7}
              maxLength={15}
            />
          </div>
          <GenderSelect
            value={form.gender}
            onChange={(value) => setForm({ ...form, gender: value })}
            className="[&>label]:mb-1 [&_select]:border-border [&_select]:rounded-xl [&_select]:py-2.5"
          />
          </div>
        </div>
      </div>

      {/* Per-user calendar preference */}
      <div className="rounded-2xl bg-white border border-border shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-slate-600" />
            <div>
              <h3 className="font-bold text-slate-800">Calendar Preference</h3>
              <p className="text-xs text-slate-400">Choose how dates appear for you across the app</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, calendarPreference: "bs" }))}
              className={`flex-1 py-4 px-5 rounded-xl border-2 text-center transition-all ${
                form.calendarPreference === "bs"
                  ? "border-primary bg-secondary/40 text-primary font-bold shadow-sm"
                  : "border-border bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <div className="text-lg font-bold">२६ श्रावण २०८३</div>
              <div className="text-xs mt-1 opacity-70">Nepali (Bikram Sambat)</div>
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, calendarPreference: "ad" }))}
              className={`flex-1 py-4 px-5 rounded-xl border-2 text-center transition-all ${
                form.calendarPreference === "ad"
                  ? "border-primary bg-secondary/40 text-primary font-bold shadow-sm"
                  : "border-border bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <div className="text-lg font-bold">10 Aug 2026</div>
              <div className="text-xs mt-1 opacity-70">English (AD / Gregorian)</div>
            </button>
          </div>
        </div>
      </div>

      {/* Locked work info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Job info card - locked fields */}
        <div className="rounded-2xl bg-white border border-border shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Job Information</h3>
            <p className="text-xs text-slate-400 mt-0.5">Only admins can change these</p>
          </div>
          <div className="p-6 space-y-5">
            {isSuperAdminNoEmp ? (
              <>
                <InfoRow icon={Building2} label="Department" value="All Departments (Full Access)" />
                <InfoRow icon={BriefcaseBusiness} label="Designation" value="System Administrator" />
                <InfoRow icon={MapPin} label="Branch" value="All Branches (Full Access)" />
                <InfoRow icon={User} label="Employee ID" value={displayId} />
              </>
            ) : (
              <>
                <InfoRow icon={Building2} label="Department" value={emp?.department?.name || "Not assigned"} />
                <InfoRow icon={BriefcaseBusiness} label="Designation" value={emp?.designation?.name || "Not assigned"} />
                <InfoRow icon={MapPin} label="Branch" value={emp?.branch?.name || "Not assigned"} />
                <InfoRow icon={User} label="Employee ID" value={emp?.employeeId || displayId} />
              </>
            )}
          </div>
        </div>

        {/* Account info card - locked fields */}
        <div className="rounded-2xl bg-white border border-border shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Account Information</h3>
            <p className="text-xs text-slate-400 mt-0.5">Only admins can change these</p>
          </div>
          <div className="p-6 space-y-5">
            <InfoRow icon={Shield} label="Role" value={formatRole(profile.role)} />
            <InfoRow icon={Calendar} label="Joining Date" value={joiningValue ? formatDate(new Date(joiningValue), calPref) : "-"} />
            <InfoRow icon={Lock} label="Status" value={emp?.status || profile.status} />
            <InfoRow icon={Mail} label="Login Email" value={profile.email} />
          </div>
        </div>
      </div>

      {/* Password change section */}
      <div className="rounded-2xl bg-white border border-border shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock size={20} className="text-slate-600" />
            <h3 className="font-bold text-slate-800">Change Password</h3>
          </div>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-sm text-primary hover:underline font-medium"
            >
              Change Password
            </button>
          )}
        </div>

        {showPasswordForm && (
          <div className="p-6 space-y-4">
            <div className="max-w-md">
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full border border-border rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  required
                />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full border border-border rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Fill the password fields, then press the <span className="font-medium text-primary">Save Changes</span> button to update your password.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowPasswordForm(false); setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" }); }}
                className="px-5 py-2.5 rounded-xl border border-border text-sm text-slate-600 hover:bg-secondary/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating save - bottom right, only toggles when there are changes */}
      {(hasPendingChanges || saving) && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 pl-4 pr-2 py-2 bg-slate-900 text-white rounded-2xl shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-4">
          <p className="text-xs font-medium text-slate-200 pl-1">You have unsaved changes</p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Save size={15} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}

// reusable info row component
function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <Icon size={18} className="text-slate-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-800 font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
