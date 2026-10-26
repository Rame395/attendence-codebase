import axiosInstance from "../config/ApiClient";
import { toLocalDateInput } from "./nepali-date";

export interface IHolidayLike {
  _id: string;
  title: string;
  startDate: string;
  endDate: string;
  gender?: "both" | "male" | "female" | string | null;
  appliesTo?: "all" | "branch" | "department" | string | null;
  branches?: (string | { _id: string })[] | null;
  departments?: (string | { _id: string })[] | null;
}

// viewer ko scope - /employees/me bata (gender + branch + department)
// null = unknown (e.g. employee profile nabhayeko admin) -> sabai dekhaune
export interface IHolidayViewer {
  gender?: string | null;
  branchId?: string | null;
  deptId?: string | null;
}

const refId = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  const id = (v as { _id?: unknown })._id ?? v;
  return String(id ?? "");
};

// backend AttendanceService.filterApplicableHolidays sanga mirror -
// gender/branch/department scope namileko holiday lukaune
export function isHolidayApplicable(h: IHolidayLike, viewer: IHolidayViewer | null): boolean {
  if (!viewer) return true;
  if (h.gender && h.gender !== "both") {
    const g = viewer.gender || "other";
    if (h.gender !== g) return false;
  }
  if (h.appliesTo === "branch") {
    const ids = (h.branches || []).map(refId).filter(Boolean);
    if (!viewer.branchId || !ids.includes(viewer.branchId)) return false;
  }
  if (h.appliesTo === "department") {
    const ids = (h.departments || []).map(refId).filter(Boolean);
    if (!viewer.deptId || !ids.includes(viewer.deptId)) return false;
  }
  return true;
}

// holiday le kunai din (local "YYYY-MM-DD") cover garxa ki
export function holidayCoversDate(h: IHolidayLike, dateKey: string): boolean {
  if (!h.startDate || !h.endDate) return false;
  try {
    return toLocalDateInput(new Date(h.startDate)) <= dateKey && dateKey <= toLocalDateInput(new Date(h.endDate));
  } catch {
    return false;
  }
}

// /employees/me bata viewer scope nikalne (fail bhaye null -> sabai dekhaune)
export async function fetchHolidayViewer(): Promise<IHolidayViewer | null> {
  try {
    const res = (await axiosInstance.get("/employees/me")) as unknown as {
      data?: {
        employee?: {
          gender?: string | null;
          branch?: string | { _id: string } | null;
          department?: string | { _id: string } | null;
        } | null;
      };
    };
    const emp = res?.data?.employee;
    if (!emp) return null;
    return {
      gender: emp.gender || null,
      branchId: refId(emp.branch) || null,
      deptId: refId(emp.department) || null,
    };
  } catch {
    return null;
  }
}
