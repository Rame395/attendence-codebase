// permission keys - owner tick dincha, frontend sync
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

export function isValidPermission(value: unknown): value is PermissionKey {
  return (
    typeof value === "string" &&
    (PERMISSION_KEYS as readonly string[]).includes(value)
  );
}
