import type { ReactNode } from "react";
import { useAppSelector } from "../../lib/hooks/redux";
import { canAccess, isOwner } from "../../lib/permissions";

// allow access - role(s) matra dekhauxa, array + permission ticks + ownerOnly support
export default function AllowAccess({
  children,
  role,
  permission,
  ownerOnly,
}: Readonly<{
  children: ReactNode;
  role?: string | string[];
  permission?: string | string[];
  ownerOnly?: boolean;
}>) {
  const { authUser } = useAppSelector((state) => state.auth);

  if (!authUser) return <></>;

  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(authUser.role)) return <></>;
  }

  if (ownerOnly && !isOwner(authUser)) return <></>;

  if (!canAccess(authUser, permission)) return <></>;

  return children;
}
