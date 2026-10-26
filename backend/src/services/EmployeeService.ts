import EmployeeModel from "../model/EmployeeModel.js";
import UserModel from "../model/UserModel.js";
import PhoneDirectoryService from "./PhoneDirectoryService.js";
import UserDirectoryService from "./UserDirectoryService.js";
import { currentDbName } from "../config/tenantStore.js";
import { CENTRAL_DB_NAME } from "../config/tenant.js";

class EmployeeService {
  // khali string ("") haru hatayera model samma pathaune (cast error bata jogin)
  private static stripEmpty(data: Record<string, unknown>): Record<string, any> {
    return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "")) as Record<string, any>;
  }

  // valid manager-role employee matra assign (inactive/invalid reject, scope-aware)
  static async resolveValidManager(
    managerId: string | null | undefined,
    opts: { excludeEmployeeId?: string; scopeBranch?: string | null } = {},
  ): Promise<string | null> {
    if (!managerId) return null;

    const managerEmp: any = await EmployeeModel.findById(managerId)
      .select("status isDeleted branch")
      .lean();

    if (!managerEmp || managerEmp.isDeleted === true || managerEmp.status === "inactive") {
      throw { code: 422, message: "Selected manager is not available" };
    }

    if (opts.excludeEmployeeId && managerEmp._id.toString() === opts.excludeEmployeeId.toString()) {
      throw { code: 422, message: "An employee cannot be their own manager" };
    }

    const managerUser = await UserModel.findOne({
      employee: managerEmp._id,
      role: "manager",
    })
      .select("_id")
      .lean();
    if (!managerUser) {
      throw { code: 422, message: "Selected employee does not have a Manager account" };
    }

    if (opts.scopeBranch) {
      const mb = managerEmp.branch;
      const mbStr =
        typeof mb === "string"
          ? mb
          : mb?._id?.toString?.() || mb?.toString?.();
      if (mbStr && mbStr !== opts.scopeBranch) {
        throw { code: 403, message: "Manager must be from your own branch" };
      }
    }

    return managerEmp._id.toString();
  }

  static async getAllEmployees(filters: any = {}) {
    const query: any = {};

    // removed employees by default list ma audaina (report ma matra dekhine)
    if (filters.includeRemoved !== true && filters.includeRemoved !== "true") {
      query.isDeleted = { $ne: true };
    }

    if (filters.branch) query.branch = filters.branch;
    if (filters.department) query.department = filters.department;
    if (filters.designation) query.designation = filters.designation;
    // manager team scope: aafno direct reports matra
    if (filters.manager) query.manager = filters.manager;

    // managersOnly: manager-role users sanga linked employees matra
    if (filters.managersOnly === true || filters.managersOnly === "true") {
      const managerUsers = await UserModel.find({ role: "manager" })
        .select("employee")
        .lean();
      const managerEmpIds = managerUsers.map((u: any) => u.employee).filter(Boolean);
      if (managerEmpIds.length === 0) return [];
      query._id = { $in: managerEmpIds };
    } else if (filters.includeStaff !== true && filters.includeStaff !== "true") {
      // hr_admin/manager users employee list ma na dekhaune
      const staffUsers = await UserModel.find({
        role: { $in: ["hr_admin", "manager"] },
      })
        .select("employee")
        .lean();
      const staffEmpIds = staffUsers.map((u: any) => u.employee).filter(Boolean);
      if (staffEmpIds.length > 0) {
        query._id = { $nin: staffEmpIds };
      }
    }

    return await EmployeeModel.find(query)
      .populate("department", "name code")
      .populate("designation", "name")
      .populate("branch", "name code")
      .populate("manager", "name employeeId")
      .sort({ createdAt: -1 });
  }

  static async getEmployeeById(id: string) {
    return await EmployeeModel.findById(id)
      .populate("department", "name code")
      .populate("designation", "name")
      .populate("branch", "name code")
      .populate("manager", "name employeeId");
  }

  static async createEmployee(data: any) {
    const sanitized = this.stripEmpty(data);

    // email global free chha ki chhaina - directory check (login account bina ko employee path)
    if (sanitized.email) {
      const platformAdminEmail =
        (process.env.PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim();
      const normalizedEmail = String(sanitized.email).toLowerCase().trim();
      if (platformAdminEmail && normalizedEmail === platformAdminEmail) {
        throw {
          code: 409,
          message: "This email belongs to the Platform Admin. Please use a different email.",
        };
      }
      const holder: any = await UserDirectoryService.findByEmail(normalizedEmail);
      if (holder) {
        throw {
          code: 409,
          message: "This email is already in use. Please use a different email.",
        };
      }
    }

    // phone global lock
    if (sanitized.phone) {
      await PhoneDirectoryService.claimPhone({
        phone: sanitized.phone,
        dbName: currentDbName() || CENTRAL_DB_NAME,
        employeeId: null,
      });
    }

    try {
      return await EmployeeModel.create(sanitized);
    } catch (error) {
      if (sanitized.phone) await PhoneDirectoryService.releasePhone(sanitized.phone);
      throw error;
    }
  }

  static async updateEmployee(id: string, data: any) {
    const sanitized = this.stripEmpty(data);
    let claimedNewPhone: string | null = null;
    let oldPhone = "";

    // phone change - claim gari, update, purano release
    if (sanitized.phone) {
      const existing: any = await EmployeeModel.findById(id).select("phone").lean();
      oldPhone = existing?.phone?.trim?.() || "";
      if (sanitized.phone.trim() !== oldPhone) {
        await PhoneDirectoryService.claimPhone({
          phone: sanitized.phone,
          dbName: currentDbName() || CENTRAL_DB_NAME,
          employeeId: id,
        });
        claimedNewPhone = sanitized.phone;
      }
    }

    try {
      const updated =
        await EmployeeModel.findByIdAndUpdate(
          id,
          sanitized,
          {
            new: true,
            runValidators: true,
          },
        )
          .populate("department", "name code")
          .populate("designation", "name")
          .populate("branch", "name code")
          .populate("manager", "name employeeId");

      if (claimedNewPhone && oldPhone) {
        await PhoneDirectoryService.releasePhone(oldPhone);
      }
      return updated;
    } catch (error) {
      if (claimedNewPhone) await PhoneDirectoryService.releasePhone(claimedNewPhone);
      throw error;
    }
  }

  // soft delete - record hide garne (history/reports ko lagi surakshit rakhne)
  static async softDeleteEmployee(id: string) {
    return await EmployeeModel.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        deletedAt: new Date(),
        status: "inactive",
      },
      { new: true },
    );
  }
}

export default EmployeeService;