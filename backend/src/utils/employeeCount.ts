import UserModel from "../model/UserModel.js";
import EmployeeModel from "../model/EmployeeModel.js";

// "Total Employees" nikaalne - system accounts (hr_admin/manager/super_admin) ko
// linked employee record lai count nagarne. Actual employee = role "employee" user
// OR login bina ko standalone employee (no linked user).
export async function countActualEmployees(extra: Record<string, any> = {}) {
  const systemUserEmployeeIds = await UserModel.find({
    role: { $in: ["platform_admin", "super_admin", "hr_admin", "manager"] },
    employee: { $ne: null, $nin: [null] },
  })
    .distinct("employee");

  return EmployeeModel.countDocuments({
    status: "active",
    _id: { $nin: systemUserEmployeeIds.length ? systemUserEmployeeIds : [null] },
    ...extra,
  });
}