import { useForm } from "react-hook-form";
import {
  zodResolver,
} from "@hookform/resolvers/zod";

import {
  useAppDispatch,
} from "../../lib/hooks/redux";

import {
  loginUser,
} from "../../lib/reducers/auth-reducer";

import {
  LoginSchema,
  type ICredentials,
} from "./Auth.contract";

import {
  useNavigate,
} from "react-router-dom";

import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "../../lib/getErrorMessage";

export default function LoginForm() {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<ICredentials>({
    resolver: zodResolver(LoginSchema),

    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginHandle = async (
    credentials: ICredentials
  ) => {
    try {
      const result =
        await dispatch(
          loginUser(credentials)
        ).unwrap();

      toast.success("Login successful", {
        description:
          `Welcome ${result.user.name || "back"}!`,
      });

      // temporary password bata login gareko lai sidai password change ma pathaune
      if (result.user.mustChangePassword) {
        navigate("/change-password");
        return;
      }

      // role based redirect: employee -> /employee, platform_admin -> /PlatformAdmin, aru -> /admin
      const target =
        result.user.role === "employee"
          ? "/employee"
          : result.user.role === "platform_admin"
            ? "/PlatformAdmin"
            : "/admin";
      navigate(target);

    } catch (error) {
      toast.error(
        getErrorMessage(error, "Invalid credentials")
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit(loginHandle)}
      className="space-y-5"
    >

      {/* EMAIL */}

      <div>
        <label className="mb-2 block text-sm font-medium">
          Email
        </label>

        <input
          type="email"
          {...register("email")}
          placeholder="Enter your email"
          className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />

        {errors.email && (
          <p className="mt-1 text-sm text-red-500">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* PASSWORD */}

      <div>
        <label className="mb-2 block text-sm font-medium">
          Password
        </label>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            {...register("password")}
            placeholder="Enter your password"
            className="w-full rounded-xl border border-border px-4 py-3 pr-12 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
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

        {errors.password && (
          <p className="mt-1 text-sm text-red-500">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* FORGOT PASSWORD */}

      <div className="text-right">
        <button
          type="button"
          onClick={() =>
            navigate("/forgot-password")
          }
          className="text-sm text-primary hover:underline font-medium"
        >
          Forgot password?
        </button>
      </div>

      {/* LOGIN */}

      <button
        disabled={isSubmitting}
        type="submit"
        className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "Signing in..."
          : "Sign In"}
      </button>

    </form>
  );
}
