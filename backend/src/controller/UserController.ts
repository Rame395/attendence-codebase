import type {
  Request,
  Response,
  NextFunction,
} from "express";

import AuthService from "../services/AuthService.js";
import CompanyService from "../services/CompanyService.js";
import UserDirectoryService from "../services/UserDirectoryService.js";
import EmployeeService from "../services/EmployeeService.js";
import { currentDbName } from "../config/tenantStore.js";
import { runWithTenant } from "../config/tenant.js";
import UserModel from "../model/UserModel.js";
import EmployeeModel from "../model/EmployeeModel.js";
import DepartmentModel from "../model/DepartmentModel.js";
import BranchModel from "../model/BranchModel.js";
import AuditLogService from "../services/AuditLogService.js";
import NotificationService from "../services/NotificationService.js";
import { invalidateUserSession } from "../utils/authCache.js";
import { getRequesterBranchId, assertInScope } from "../utils/branchScope.js";

class UserController {

  getUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {

    try {

      const limit =
        Number(req.query.limit) || 10;

      const skip =
        Number(req.query.skip) || 0;

      const qRaw =
        String(req.query.q || "").trim();
      // regex special char escape + prefix (name bata start hune wala matra)
      const q = qRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const qPrefix = new RegExp(`^${q}`, "i");

      const departmentIds = q
        ? await DepartmentModel.find({
            $or: [
              { name: { $regex: qPrefix } },
              { code: { $regex: qPrefix } },
            ],
          }).distinct("_id")
        : [];

      const branchIds = q
        ? await BranchModel.find({
            $or: [
              { name: { $regex: qPrefix } },
              { code: { $regex: qPrefix } },
            ],
          }).distinct("_id")
        : [];

      const employeeIds = q
        ? await EmployeeModel.find({
            $or: [
              { name: { $regex: qPrefix } },
              { email: { $regex: qPrefix } },
              { phone: { $regex: qPrefix } },
              { employeeId: { $regex: qPrefix } },
              { department: { $in: departmentIds } },
              { branch: { $in: branchIds } },
            ],
          }).distinct("_id")
        : [];

      // super_admin ra employee lai user list bata filter garxa (employees list Employees page ma)
      const baseFilter: Record<string, any> = { role: { $nin: ["super_admin", "employee"] } };

      // role filter
      const roleFilter = String(req.query.role || "").trim();
      if (roleFilter) baseFilter.role = roleFilter;

      // branch/department filter - scope-bhako hr_admin/manager le aafno branch matra dekhcha
      const scopeBranch = await getRequesterBranchId(req.loggedInUser);
      let branchFilter = String(req.query.branch || "").trim();
      const departmentFilter = String(req.query.department || "").trim();
      if (scopeBranch) {
        if (branchFilter && branchFilter !== scopeBranch) {
          throw { code: 403, message: "Access denied for this branch" };
        }
        branchFilter = scopeBranch;
        if (departmentFilter) {
          const dept: any = await DepartmentModel.findById(departmentFilter).select("branch").lean().catch(() => null);
          if (dept?.branch && dept.branch.toString() !== scopeBranch) {
            throw { code: 403, message: "Access denied for this branch" };
          }
        }
      }
      if (branchFilter || departmentFilter) {
        const empQuery: Record<string, any> = {};
        if (branchFilter) empQuery.branch = branchFilter;
        if (departmentFilter) empQuery.department = departmentFilter;
        const employeeIds = await EmployeeModel.find(empQuery).distinct("_id");
        baseFilter.employee = { $in: employeeIds };
      }

      const searchFilter: Record<string, any> = q
        ? {
            ...baseFilter,
            $or: [
              { username: { $regex: qPrefix } },
              { email: { $regex: qPrefix } },
              { role: { $regex: qPrefix } },
              { employee: { $in: employeeIds } },
            ],
          }
        : baseFilter;

      const [users, total] =
        await Promise.all([
          UserModel.find(searchFilter)
            .select("-password -resetPasswordCode -resetPasswordExpires")
            .populate({
              path: "employee",
              select:
                "name email phone employeeId profileImage department designation branch manager status gender joiningDate",
              populate: [
                {
                  path: "department",
                  select: "name code",
                },
                {
                  path: "designation",
                  select: "name",
                },
                {
                  path: "branch",
                  select: "name code",
                },
                {
                  path: "manager",
                  select: "name employeeId",
                },
              ],
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),

          UserModel.countDocuments(searchFilter),
        ]);

      const page =
        Math.floor(skip / limit) + 1;

      res.json({
        data: users,
        message: "Users fetched successfully",
        meta: {
          pagination: {
            limit,
            skip,
            total,
            page,
            totalPage:
              Math.max(Math.ceil(total / limit), 1),
          },
        },
      });

    } catch (exception) {

      next(exception);

    }
  };

  createUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {

    try {

      // branch-scoped hr_admin le aafno branch ma matra add garna pauxa (na diye auto-fill, arko 403)
      const scopeBranch = await getRequesterBranchId(req.loggedInUser);
      if (scopeBranch) {
        const want = String((req.body as any)?.branch || "").trim();
        if (want && want !== scopeBranch) {
          throw { code: 403, message: "You can only add employees to your own branch" };
        }
        (req.body as any).branch = scopeBranch;
      }

      // afu bhanda mathillo/barabar role banauna napaos (API chhalda 403)
      const requesterRole = req.loggedInUser?.role as string | undefined;
      const targetRole = String((req.body as any)?.role || "").trim();
      const creatableByRole: Record<string, string[]> = {
        super_admin: ["hr_admin", "manager", "employee"],
        hr_admin: ["hr_admin", "manager", "employee"],
        manager: ["employee"],
      };
      if (!requesterRole || !(creatableByRole[requesterRole] || []).includes(targetRole)) {
        throw { code: 403, message: "You cannot create a user with this role" };
      }

      // manager reporting employee role lai matra - hr_admin/manager lai manager hudaina
      if ((req.body as any)?.role !== "employee") {
        (req.body as any).manager = null;
      }

      // role anusar branch/dept requirement:
      // - hr_admin: branch matra (attendance geofence ko lagi branch chainchha), dept/designation chainadaina
      // - manager: branch + department (attendance ra team scope ko lagi)
      const createRole = String((req.body as any)?.role || "").trim();
      const bodyBranch = String((req.body as any)?.branch || "").trim();
      const bodyDepartment = String((req.body as any)?.department || "").trim();
      const bodyDepartmentName = String((req.body as any)?.departmentName || "").trim();

      if (createRole === "hr_admin") {
        (req.body as any).department = null;
        (req.body as any).designation = null;
        if (!bodyBranch && !String((req.body as any)?.branchName || "").trim()) {
          throw { code: 422, message: "HR / Admin must be assigned to a branch" };
        }
      }

      if (createRole === "manager") {
        if (!bodyBranch && !String((req.body as any)?.branchName || "").trim()) {
          throw { code: 422, message: "Manager must be assigned to a branch" };
        }
        if (!bodyDepartment && !bodyDepartmentName) {
          throw { code: 422, message: "Manager must be assigned to a department" };
        }
      }

      const {
        name,
        email,
        username,
        phone,
        employeeId,
        role,
        gender,
        department,
        designation,
        branch,
        manager,
        joiningDate,
        departmentName,
        branchName,
      } = req.body;


      const createdBy =
        req.loggedInUser?._id;

      // kun company ma user banaune - resolveTargetTenant (owner le matra arko company dina pauxa)
      const { targetCompany, targetDb } =
        await CompanyService.resolveTargetTenant(req);

      const result =
        await runWithTenant(targetDb, () =>
          AuthService.createUser(
            {
              name,
              email,
              username,
              phone,
              employeeId,
              role,
              gender,
              department,
              designation,
              branch,
              manager,
              joiningDate,
              departmentName,
              branchName,
              companyId: targetCompany,
            },
            createdBy,
          ),
        );


      res.status(201).json({
        data: result,
        message: result.emailSent
          ? "User created successfully. Login credentials have been sent to email."
          : "User created successfully, but the welcome email could not be delivered. Please verify the email address.",
        meta: null,
      });

    } catch (exception) {

      next(exception);

    }
  };

  // yo function le user lai update garxa (role, status, email) - super_admin matra
  updateUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid user ID" };
      }

      const oldUser = await UserModel.findById(id);

      if (!oldUser) {
        throw { code: 404, message: "User not found" };
      }

      if (oldUser.role === "super_admin") {
        throw { code: 403, message: "Cannot update super admin" };
      }

      const { email, role, status, name, phone, gender, department, designation, branch, manager, joiningDate } = req.body;

      const employeeId = (oldUser as any).employee || null;
      // linked employee record - scope check + employee profile update ko lagi
      let oldEmployee: any = null;
      if (employeeId) {
        oldEmployee = await EmployeeModel.findById(employeeId);
      }

      // email change bhaye central directory claim (global lock, update fail bhaye release)
      const emailChanged =
        email && email.toLowerCase() !== (oldUser as any).email.toLowerCase();
      if (emailChanged) {
        const ambientDb =
          currentDbName() ||
          (await UserDirectoryService.findByEmail((oldUser as any).email))?.dbName ||
          "";
        await UserDirectoryService.claimEmail({
          email,
          dbName: ambientDb,
          userId: (oldUser as any)._id,
          company: (oldUser as any).company || null,
          role: role || (oldUser as any).role || null,
        });
      }

      const updateData: Record<string, any> = {
        updatedBy: req.loggedInUser?._id,
      };
      if (email) updateData.email = email.toLowerCase();
      if (role) updateData.role = role;
      if (status) updateData.status = status;

      // linked employee profile fields (branch/dept/designation/name/phone/gender/joining date)
      const targetRole = role || (oldUser as any).role;
      const employeeData: Record<string, any> = {};
      if (name !== undefined) employeeData.name = name;
      if (phone !== undefined) employeeData.phone = phone;
      if (gender !== undefined) employeeData.gender = gender || null;
      if (joiningDate !== undefined) employeeData.joiningDate = joiningDate ? new Date(joiningDate) : null;
      if (department !== undefined) employeeData.department = department || null;
      if (designation !== undefined) employeeData.designation = designation || null;
      if (branch !== undefined) employeeData.branch = branch || null;
      if (emailChanged) employeeData.email = email.toLowerCase();

      // manager field: non-employee role (hr_admin/manager) lai manager hudaina
      if (manager !== undefined || targetRole !== (oldUser as any).role) {
        if (targetRole === "employee" && manager) {
          employeeData.manager = await EmployeeService.resolveValidManager(manager, {
            excludeEmployeeId: employeeId || undefined,
            scopeBranch: null,
          });
        } else {
          employeeData.manager = null;
        }
      }

      // hr_admin lai dept/designation chainadaina - branch matra (role parhe bahek pani force clear)
      if (targetRole === "hr_admin") {
        employeeData.department = null;
        employeeData.designation = null;
      }

      // branch-scoped hr_admin le aafno branch ko user matra update, branch change aafnai branch ma
      const scopeBranch = await getRequesterBranchId(req.loggedInUser);
      if (scopeBranch) {
        assertInScope(oldEmployee?.branch, scopeBranch);
        if ("branch" in employeeData) {
          const want = String(employeeData.branch || "").trim();
          if (want && want !== scopeBranch) {
            throw { code: 403, message: "You can only keep users in your own branch" };
          }
          employeeData.branch = scopeBranch;
        }
      }

      // email change bhaye credentials re-issue: naya email ma matra random password pathaune
      let resetName = "";
      let resetEmailSent = true;
      let resetPassword: string | null = null;
      if (emailChanged) {
        resetName = oldEmployee?.name || (oldUser as any).username || email;
      }

      let user;
      try {
        user =
          await UserModel.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
          }).select("-password -resetPasswordCode -resetPasswordExpires");

        // naya email ma matra naya email + random password pathaune (yo nai login credential)
        // login pachi password change force huncha (mustChangePassword)
        if (emailChanged) {
          const reset = await AuthService.resetUserCredentials(id, {
            newEmail: email,
            name: resetName,
            updatedBy: req.loggedInUser?._id,
            forceChange: true,
          });
          user = reset.user;
          resetEmailSent = reset.emailSent;
          resetPassword = reset.temporaryPassword;
        }

        // linked employee ko profile pani update (branch/dept/designation etc.)
        if (employeeId && Object.keys(employeeData).length > 0) {
          await EmployeeService.updateEmployee(employeeId, employeeData);
        }
      } catch (updateError) {
        if (emailChanged) await UserDirectoryService.releaseEmail(email);
        throw updateError;
      }

      if (emailChanged) {
        // purano entry hataune + role sync (directory confirm)
        await UserDirectoryService.releaseEmail((oldUser as any).email);
        await UserDirectoryService.confirmEntry(email, {
          role: (user as any)?.role || (oldUser as any).role || null,
          userId: (oldUser as any)._id,
        });
      }

      // email/status/role change pachi purano session turuntai dead hos
      invalidateUserSession(id);

      // audit log - user updated
      AuditLogService.logAction(
        req.loggedInUser?._id?.toString(),
        "User Updated",
        "user",
        {
          targetId: id,
          oldData: { email: oldUser.email, role: oldUser.role, status: oldUser.status },
          newData: { email: user?.email, role: user?.role, status: user?.status },
          ipAddress: req.ip,
        },
      );

      // updated user lai notify garne (self-update pani samet)
      void NotificationService.notifyInfoUpdate(
        id,
        "Account Updated",
        emailChanged
          ? "Your email was changed by the administrator. New login credentials have been sent to your new email. You will need to set a new password on next login."
          : "Your account information has been updated by the administrator.",
      );

      res.json({
        data: user,
        message:
          emailChanged && !resetEmailSent
            ? "User updated successfully - the credential email could not be sent. Share the login password manually."
            : "User updated successfully",
        meta: null,
        ...(emailChanged && !resetEmailSent && resetPassword
          ? { temporaryPassword: resetPassword }
          : {}),
      });
    } catch (exception) {
      next(exception);
    }
  };

  // yo function le user lai delete garxa
  deleteUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid user ID" };
      }

      const user = await UserModel.findById(id);

      if (!user) {
        throw { code: 404, message: "User not found" };
      }

      // super_admin lai delete garna didaina
      if (user.role === "super_admin") {
        throw { code: 403, message: "Cannot delete super admin" };
      }

      // linked employee soft delete (history/report safe)
      if (user.employee) {
        await EmployeeModel.findByIdAndUpdate(user.employee, {
          isDeleted: true,
          deletedAt: new Date(),
          status: "inactive",
        });
      }

      await UserModel.findByIdAndDelete(id);

      // delete pachi purano token pani dead
      invalidateUserSession(id);

      // central directory bata pani hataune (email reuse huna paos)
      await UserDirectoryService.removeByEmail((user as any).email);

      // audit log - user deleted
      AuditLogService.logAction(
        req.loggedInUser?._id?.toString(),
        "User Deleted",
        "user",
        {
          targetId: id,
          oldData: { email: user.email, role: user.role, status: user.status },
          ipAddress: req.ip,
        },
      );

      res.json({
        data: null,
        message: "User deleted successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };
}


export default UserController;
