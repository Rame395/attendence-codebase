import {
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  toast,
} from "sonner";

import {
  ArrowLeft,
} from "lucide-react";

import axiosInstance from "../../config/ApiClient";
import { getErrorMessage } from "../../lib/getErrorMessage";


export default function ForgotPassword() {

  const navigate =
    useNavigate();


  const [email, setEmail] =
    useState("");


  const [loading, setLoading] =
    useState(false);


  const submit = async (
    e: React.FormEvent,
  ) => {

    e.preventDefault();

    try {

      setLoading(true);


      await axiosInstance.post(
        "/auth/forgot-password",
        {
          email,
        },
      );


      toast.success(
        "Reset code sent to your email",
      );


      navigate(
        `/reset-password?email=${encodeURIComponent(email)}`,
      );


    } catch (error) {

      toast.error(
        getErrorMessage(
          error,
          "Unable to send reset code",
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
            navigate("/login")
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
          Forgot Password
        </h1>

        <p className="text-slate-500 mt-2 mb-6">
          Enter your registered email.
          We will send you a reset code.
        </p>


        <form
          onSubmit={submit}
          className="space-y-4"
        >

          <input
            type="email"
            required
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }

            placeholder="Registered email"

            className="w-full border border-border rounded-xl p-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />


          <button
            disabled={loading}
            className="w-full bg-primary text-white p-3 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors disabled:opacity-50"
          >

            {loading
              ? "Sending..."
              : "Send Reset Code"}

          </button>

        </form>

      </div>

    </div>
  );
}