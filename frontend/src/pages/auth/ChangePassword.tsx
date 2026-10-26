import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";

import {
  useAppDispatch,
  useAppSelector,
} from "../../lib/hooks/redux";
import { changeFirstPassword } from "../../lib/reducers/auth-reducer";
import { getErrorMessage } from "../../lib/getErrorMessage";

export default function ChangePassword() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, authUser } = useAppSelector((state) => state.auth);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // password change gari sakeko lai dashboard ma puraunu
  if (
    !isAuthenticated ||
    !authUser?.mustChangePassword
  ) {
    const target = authUser?.role === "employee" ? "/employee" : "/admin";
    return (
      <Navigate
        to={target}
        replace
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setSubmitting(true);
      await dispatch(changeFirstPassword(newPassword)).unwrap();
      toast.success("Password changed successfully");
      const target = authUser?.role === "employee" ? "/employee" : "/admin";
      navigate(target, { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to change password"));
    } finally {
      setSubmitting(false);
    }
  };

  const passwordStrength = (pw: string) => {
    return {
      lower: /[a-z]/.test(pw),
      upper: /[A-Z]/.test(pw),
      digit: /\d/.test(pw),
      special: /\W/.test(pw),
      length: pw.length >= 8,
    };
  };

  const s = passwordStrength(newPassword);
  const isValid =
    s.lower && s.upper && s.digit && s.special && s.length;

  const requirements = [
    { label: "At least 8 characters", ok: s.length },
    { label: "Uppercase letter", ok: s.upper },
    { label: "Lowercase letter", ok: s.lower },
    { label: "Number", ok: s.digit },
    { label: "Special character", ok: s.special },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-active to-primary flex items-center justify-center px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-secondary/15 blur-3xl" />

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-white/20 relative">

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/10">
            <KeyRound size={28} />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Set Your New Password
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Your account is using a temporary password. Please set a new password to continue.
            It must be different from the temporary password.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >

          {/* NEW PASSWORD */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter a strong password"
                className="w-full rounded-xl border border-border px-4 py-3 pr-12 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPw((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label={showNewPw ? "Hide password" : "Show password"}
              >
                {showNewPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Password requirements */}
            <div className="mt-3 rounded-xl bg-secondary/30 p-3 grid grid-cols-2 gap-1.5">
              {requirements.map((r) => (
                <div key={r.label} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${r.ok ? "bg-green-500" : "bg-slate-300"}`} />
                  <span className={r.ok ? "text-green-700" : "text-slate-500"}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CONFIRM PASSWORD */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter the new password"
                className="w-full rounded-xl border border-border px-4 py-3 pr-12 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label={showConfirmPw ? "Hide password" : "Show password"}
              >
                {showConfirmPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-sm text-red-500">
                Passwords do not match
              </p>
            )}
          </div>

          {/* SUBMIT */}
          <button
            disabled={submitting || !isValid}
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Updating..." : "Set Password"}
          </button>

        </form>
      </div>
    </div>
  );
}
