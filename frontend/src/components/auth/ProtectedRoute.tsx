import {
  Navigate,
  Outlet,
} from "react-router-dom";

import type { ReactNode } from "react";

import {
  useAppSelector,
} from "../../lib/hooks/redux";

import {
  canAccess,
  isOwner,
} from "../../lib/permissions";

import { ShieldAlert } from "lucide-react";

interface Props {
  allowedRoles?: string[];
  permission?: string | string[];
  ownerOnly?: boolean;
  denyRoles?: string[];
  children?: ReactNode;
}

export default function ProtectedRoute({
  allowedRoles,
  permission,
  ownerOnly,
  denyRoles,
  children,
}: Props) {

  const {
    isAuthenticated,
    authUser,
  } = useAppSelector(
    (state) => state.auth
  );

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // password change gari sakeko chaina bhane sidai change-password ma pathaune
  if (authUser?.mustChangePassword) {
    return (
      <Navigate
        to="/change-password"
        replace
      />
    );
  }

  if (
    allowedRoles &&
    authUser &&
    !allowedRoles.includes(
      authUser.role
    )
  ) {
    // role anusar sahi thaal ma pathaune (employee -> /employee, baki -> /admin)
    return (
      <Navigate
        to={authUser.role === "employee" ? "/employee" : "/admin"}
        replace
      />
    );
  }

  // tick-based access - redirect loop nabhos bhanera restricted card dekhaune
  if (
    (ownerOnly && !isOwner(authUser)) ||
    (denyRoles && authUser && denyRoles.includes(authUser.role)) ||
    !canAccess(authUser, permission)
  ) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-3">
          <ShieldAlert size={22} />
        </span>
        <p className="font-bold text-slate-800">Access restricted</p>
        <p className="text-sm text-slate-500 mt-1">
          This function is not enabled for your account. Contact your administrator.
        </p>
      </div>
    );
  }

  return children ?? <Outlet />;
}
