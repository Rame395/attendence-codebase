import LoginForm from "../../components/auth/LoginForm";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "../../lib/hooks/redux";

export default function Login() {
  const { isAuthenticated, authUser } = useAppSelector(
    (state) => state.auth
  );
  const { settings } = useAppSelector((state) => state.companySetting);

  if (isAuthenticated) {
    // role based redirect: super_admin/ hr_admin/ manager sabai /admin ma janxa
    const target = authUser?.role === "employee" ? "/employee" : "/admin";
    return (
      <Navigate
        to={target}
        replace
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-active to-primary flex items-center justify-center px-4 relative overflow-hidden">
      {/* subtle secondary glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-secondary/15 blur-3xl" />

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-white/20 relative">

        <div className="mb-8 text-center">

          <img
            src="/logo.svg"
            alt="Attendance System"
            className="mx-auto mb-4 h-16 w-16 rounded-2xl object-contain bg-white shadow-lg shadow-primary/10 ring-1 ring-border/30"
          />

          <h1 className="text-3xl font-bold text-slate-900">
            {settings.companyName || "Attendance System"}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Sign in to your account
          </p>

        </div>

        <LoginForm />

      </div>

    </div>
  );
}
