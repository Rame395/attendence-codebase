import {
  useState,
} from "react";

import {
  useSearchParams,
  useNavigate,
} from "react-router-dom";

import {
  toast,
} from "sonner";

import {
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

import axiosInstance from "../../config/ApiClient";
import { getErrorMessage } from "../../lib/getErrorMessage";


// backend ko ResetPasswordDTO sanga match garne strong password rule
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d])(?=.*[\W]).{8,25}$/;

const PASSWORD_REQUIREMENT_MSG =
  "Password must be 8-25 characters and include uppercase, lowercase, number and special character";

export default function ResetPassword() {

  const [params] =
    useSearchParams();


  const navigate =
    useNavigate();


  const email =
    params.get("email") || "";


  const [code, setCode] =
    useState("");


  const [password, setPassword] =
    useState("");


  const [confirmPassword, setConfirmPassword] =
    useState("");


  const [showPassword, setShowPassword] =
    useState(false);


  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);


  const [loading, setLoading] =
    useState(false);


  const submit = async (
    e: React.FormEvent,
  ) => {

    e.preventDefault();


    // code 6 digit chaina
    if (code.length !== 6) {

      toast.error(
        "Please enter the 6 digit verification code sent to your email",
      );

      return;

    }


    // password requirement meet gardaina
    if (!STRONG_PASSWORD_REGEX.test(password)) {

      toast.error(
        PASSWORD_REQUIREMENT_MSG,
      );

      return;

    }


    // confirm password match gardaina
    if (password !== confirmPassword) {

      toast.error(
        "New password and confirm new password do not match",
      );

      return;

    }


    try {

      setLoading(true);


      await axiosInstance.post(
        "/auth/reset-password",
        {
          email,
          code,
          password,
        },
      );


      toast.success(
        "Password reset successful",
      );


      navigate("/login");


    } catch (error) {

      // backend bata aayeko specific error - expired code, galat code, invalid email etc
      toast.error(
        getErrorMessage(
          error,
          "Invalid or expired code",
        ),
      );

    } finally {

      setLoading(false);

    }
  };


  return (

    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary-active to-primary px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-secondary/15 blur-3xl" />

      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20 relative">
        <button
          type="button"
          onClick={() =>
            navigate("/forgot-password")
          }
          className="absolute top-5 left-5 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="text-center mb-6">
          <img src="/logo.svg" alt="Attendance" className="mx-auto h-14 w-14 rounded-2xl object-contain bg-white shadow-md ring-1 ring-border/30" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">
          Reset Password
        </h1>


        <p className="text-sm text-gray-500 my-4">
          Code sent to:
          <br />
          <b>{email}</b>
        </p>


        <form
          onSubmit={submit}
          className="space-y-4"
        >

          <input
            value={code}
            onChange={(e) =>
              setCode(e.target.value)
            }

            placeholder="6 digit code"

            maxLength={6}

            className="w-full border border-border rounded-xl p-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />


          <div className="relative">

            <input
              type={showPassword ? "text" : "password"}

              value={password}

              onChange={(e) =>
                setPassword(e.target.value)
              }

              placeholder="New password"

              className="w-full border border-border rounded-xl p-3 pr-12 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword((prev) => !prev)
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? (
                <EyeOff size={20} />
              ) : (
                <Eye size={20} />
              )}
            </button>

          </div>


          <div className="relative">

            <input
              type={showConfirmPassword ? "text" : "password"}

              value={confirmPassword}

              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }

              placeholder="Confirm new password"

              className="w-full border border-border rounded-xl p-3 pr-12 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />

            <button
              type="button"
              onClick={() =>
                setShowConfirmPassword((prev) => !prev)
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              aria-label={
                showConfirmPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showConfirmPassword ? (
                <EyeOff size={20} />
              ) : (
                <Eye size={20} />
              )}
            </button>

          </div>


          <button
            disabled={loading}

            className="w-full bg-primary text-white p-3 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >

            {loading
              ? "Resetting..."
              : "Reset Password"}

          </button>

        </form>

      </div>

    </div>
  );
}
