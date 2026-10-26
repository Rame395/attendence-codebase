import type { IUserDetail } from "../components/auth/Auth.contract";

// sidebar/function permission keys - backend utils/permissions.ts sanga sync
export const PERMISSION_KEYS = [
  "dashboard",
  "reports",
  "audit-logs",
  "users",
  "employees",
  "departments",
  "designations",
  "branches",
  "attendance",
  "notifications",
  "leave",
  "corrections",
  "holidays",
  "events",
  "calendar",
  "settings",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  dashboard: "Dashboard",
  reports: "Reports",
  "audit-logs": "Audit History",
  users: "Users",
  employees: "Employees",
  departments: "Departments",
  designations: "Designations",
  branches: "Branches",
  attendance: "Attendance",
  notifications: "Notifications",
  leave: "Leave Requests",
  corrections: "Corrections",
  holidays: "Holidays",
  events: "Events",
  calendar: "My Calendar",
  settings: "Settings",
};

// system owner - platform_admin matra, company superadmin kahilyai owner hoina
export function isOwner(user?: IUserDetail | null): boolean {
  return !!user && user.role === "platform_admin";
}

// kamtima euta key chha ki - owner sadhai true, non-super_admin role system le handle garxa
export function canAccess(
  user: IUserDetail | null | undefined,
  permission?: string | string[],
): boolean {
  if (!permission) return true;
  if (!user) return false;
  if (isOwner(user)) return true;
  if (user.role !== "super_admin") return true;
  const granted = user.permissions || [];
  const keys = Array.isArray(permission) ? permission : [permission];
  return keys.some((k) => granted.includes(k));
}
