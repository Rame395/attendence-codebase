import type {
  Request,
  Response,
  NextFunction,
} from "express";

import mongoose from "mongoose";
import { removeStoredFile, saveUploadedFile } from "../utils/fileStorage.js";
import {
  getRequesterBranchId,
  getRequesterEmployeeId,
  assertInScope,
  assertEmployeeInTeam,
} from "../utils/branchScope.js";
import EmployeeService from "../services/EmployeeService.js";
import AuthService from "../services/AuthService.js";
import UserDirectoryService from "../services/UserDirectoryService.js";
import { currentDbName } from "../config/tenantStore.js";
import EmployeeModel from "../model/EmployeeModel.js";
import UserModel from "../model/UserModel.js";
import LeaveRequestModel from "../model/LeaveRequestModel.js";
import AttendanceCorrectionModel from "../model/AttendanceCorrectionModel.js";
import NotificationModel from "../model/NotificationModel.js";
import AuditLogService from "../services/AuditLogService.js";
import NotificationService from "../services/NotificationService.js";
import { invalidateUserSession } from "../utils/authCache.js";

class EmployeeController {

  // sabai employees - hr_admin aafno branch, manager direct reports
  getAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const scopeBranch = await getRequesterBranchId(req.loggedInUser);
      const managerId = await getRequesterEmployeeId(req.loggedInUser);
      const qBranch = String(req.query.branch || "").trim();
      if (scopeBranch && qBranch && qBranch !== scopeBranch) {
        throw { code: 403, message: "Access denied for this branch" };
      }
      const employees =
        await EmployeeService.getAllEmployees({
          ...req.query,
          ...(scopeBranch ? { branch: scopeBranch } : {}),
          ...(managerId ? { manager: managerId } : {}),
        });

      res.json({
        data: employees,
        message: "Employees fetched successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // yo function le euta employee ko detail dinxa
  getSingle = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid employee ID" };
      }

      const employee =
        await EmployeeService.getEmployeeById(id);

      if (!employee) {
        throw { code: 404, message: "Employee not found" };
      }

      // manager bahira ko detail, branch-scoped hr_admin arko branch ko detail herna napaos
      const isManager = req.loggedInUser?.role === "manager";
      if (isManager) {
        await assertEmployeeInTeam(employee as any, req.loggedInUser);
      } else {
        assertInScope(
          (employee as any)?.branch?._id || (employee as any)?.branch,
          await getRequesterBranchId(req.loggedInUser),
        );
      }

      res.json({
        data: employee,
        message: "Employee fetched successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // yo function le logged-in employee ko aafno profile dinxa
  getMyProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.loggedInUser?._id;

      if (!userId) {
        throw { code: 401, message: "Unauthorized" };
      }

      const user = await UserModel.findById(userId)
        .select("-password -resetPasswordCode -resetPasswordExpires")
        .populate({
          path: "employee",
          select: "employeeId name email phone gender profileImage department designation branch joiningDate status",
          populate: [
            { path: "department", select: "name code" },
            { path: "designation", select: "name" },
            { path: "branch", select: "name code" },
          ],
        });

      if (!user) {
        throw { code: 404, message: "User not found" };
      }

      res.json({
        data: user,
        message: "Profile fetched successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // yo function le employee lai aafno profile update garna dinxa
  updateMyProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.loggedInUser?._id;

      if (!userId) {
        throw { code: 401, message: "Unauthorized" };
      }

      const user = await UserModel.findById(userId);

      if (!user || !user.employee) {
        throw { code: 404, message: "Employee profile not found" };
      }

      // phone ra email matra update garna dinxa employee lai
      const { phone, email } = req.body;

      // email change garne ho bhane global uniqueness check
      const currentEmployeeDoc: any =
        await EmployeeModel.findById(user.employee).select("email").lean();
      const currentEmail = (currentEmployeeDoc?.email || "").toLowerCase();
      if (
        email &&
        String(email).trim().toLowerCase() !== currentEmail
      ) {
        const platformAdminEmail =
          (process.env.PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim();
        const normalizedEmail = String(email).trim().toLowerCase();
        if (platformAdminEmail && normalizedEmail === platformAdminEmail) {
          throw { code: 409, message: "This email belongs to the Platform Admin. Please use a different email." };
        }
        const holder: any = await UserDirectoryService.findByEmail(normalizedEmail);
        if (holder) {
          throw { code: 409, message: "This email is already in use. Please use a different email." };
        }
      }

      const updateData: Record<string, any> = {};
      if (phone) updateData.phone = phone;
      if (email) updateData.email = email;

      const employee =
        await EmployeeService.updateEmployee(
          user.employee.toString(),
          updateData,
        );

      res.json({
        data: employee,
        message: "Profile updated successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // yo function le naya employee create garxa
  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = req.body;
      const createdBy = req.loggedInUser?._id;

      // joiningDate cha bhane Date object ma convert garxa
      if (data.joiningDate) {
        data.joiningDate = new Date(data.joiningDate);
      }

      // empty string lai null ma convert garxa
      if (!data.department) data.department = null;
      if (!data.designation) data.designation = null;
      if (!data.branch) data.branch = null;
      if (!data.manager) data.manager = null;

      // branch-scoped le aafno branch ma matra add - na diye auto-fill, arko 403
      const scopeBranch = await getRequesterBranchId(req.loggedInUser);
      if (scopeBranch) {
        if (data.branch && String(data.branch) !== scopeBranch) {
          throw { code: 403, message: "You can only add employees to your own branch" };
        }
        data.branch = scopeBranch;
      }

      // manager field ma valid manager-role employee matra - employee role aruko manager huna sakdaina
      data.manager = await EmployeeService.resolveValidManager(data.manager, { scopeBranch });

      const employee =
        await EmployeeService.createEmployee({
          ...data,
          createdBy,
        });

      // audit log - employee created
      AuditLogService.logAction(
        createdBy?.toString(),
        "Employee Created",
        "employee",
        {
          targetId: employee?._id?.toString(),
          employee: employee?._id?.toString(),
          newData: { employeeId: employee.employeeId, name: employee.name, email: employee.email },
          ipAddress: req.ip,
        },
      );

      res.status(201).json({
        data: employee,
        message: "Employee created successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // yo function le super_admin le employee update garna dinxa
  update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid employee ID" };
      }

      // manager le branch/department/manager reassign garna sakdaina - aru details matra
      if (req.loggedInUser?.role === "manager") {
        delete req.body.branch;
        delete req.body.department;
        delete req.body.manager;
      }

      const oldEmployee: any =
        await EmployeeService.getEmployeeById(id);

      // manager le aafno direct reports matra update garna pauxa
      if (req.loggedInUser?.role === "manager") {
        const oldManager = oldEmployee?.manager?._id?.toString?.() ?? oldEmployee?.manager?.toString?.() ?? null;
        const selfManagerId = await getRequesterEmployeeId(req.loggedInUser);
        if (!selfManagerId || oldManager !== selfManagerId) {
          throw { code: 403, message: "Access denied: employee is not in your team" };
        }
      }

      // branch-scoped user le aafno branch matra update, arko branch ma sarna napaos
      const scopeBranch = await getRequesterBranchId(req.loggedInUser);
      if (scopeBranch) {
        assertInScope(oldEmployee?.branch?._id || oldEmployee?.branch, scopeBranch);
        if (req.body && "branch" in req.body) {
          const want = String(req.body.branch || "").trim();
          if (want && want !== scopeBranch) {
            throw { code: 403, message: "You can only keep employees in your own branch" };
          }
          req.body.branch = scopeBranch;
        }
      }

      // manager field ma valid manager-role employee matra (self exclude)
      if (req.body && "manager" in req.body) {
        req.body.manager = await EmployeeService.resolveValidManager(req.body.manager, {
          excludeEmployeeId: id,
          scopeBranch,
        });
      }

      // email change bhaye linked login account ko email + temp password reset garne
      const newEmail = req.body?.email ? String(req.body.email).trim() : "";
      const oldEmail = (oldEmployee?.email || "").toLowerCase();
      const emailChanged = !!newEmail && newEmail.toLowerCase() !== oldEmail;

      let linkedUser: any = null;
      let resetEmailSent = true;
      let resetPassword: string | null = null;

      if (emailChanged) {
        linkedUser = await UserModel.findOne({ employee: id });
        if (linkedUser) {
          await UserDirectoryService.claimEmail({
            email: newEmail,
            dbName: currentDbName() || "",
            userId: linkedUser._id,
            company: (linkedUser as any).company || null,
            role: (linkedUser as any).role || null,
          });
          try {
            const reset =
              await AuthService.resetUserCredentials(linkedUser._id, {
                newEmail,
                name: req.body?.name || oldEmployee?.name || newEmail,
                updatedBy: req.loggedInUser?._id,
                forceChange: true,
              });
            resetEmailSent = reset.emailSent;
            resetPassword = reset.temporaryPassword;
          } catch (resetError) {
            await UserDirectoryService.releaseEmail(newEmail);
            throw resetError;
          }
        }
      }

      let emailReleased = false;
      try {
        const employee =
          await EmployeeService.updateEmployee(id, req.body);

        if (!employee) {
          throw { code: 404, message: "Employee not found" };
        }

        // purano email directory bata hataune, naya confirm garne
        if (emailChanged && linkedUser) {
          await UserDirectoryService.releaseEmail(oldEmail);
          await UserDirectoryService.confirmEntry(newEmail, {
            role: (linkedUser as any).role || null,
            userId: linkedUser._id,
          });
        }
        emailReleased = true;

        // audit log - employee updated (status change include garne)
        AuditLogService.logAction(
          req.loggedInUser?._id?.toString(),
          "Employee Updated",
          "employee",
          {
            targetId: id,
            employee: id,
            oldData: { status: oldEmployee?.status, email: oldEmployee?.email, phone: oldEmployee?.phone },
            newData: { status: employee.status, email: employee.email, phone: employee.phone },
            ipAddress: req.ip,
          },
        );

// updated employee lai notify garne
        const notifyUserId =
          linkedUser?._id?.toString?.() ||
          (await NotificationService.getUserIdFromEmployee(id));
        void NotificationService.notifyInfoUpdate(
          notifyUserId || "",
          "Profile Updated",
          emailChanged
            ? "Your email was changed by the administrator. New login credentials have been sent to your new email. You will need to set a new password on next login."
            : "Your profile information has been updated by the administrator.",
        );

res.json({
          data: employee,
          message:
            emailChanged && linkedUser && !resetEmailSent
              ? "Employee updated successfully - the credential email could not be sent. Share the login password manually."
              : "Employee updated successfully",
          meta: null,
          ...(emailChanged && linkedUser && !resetEmailSent && resetPassword
            ? { temporaryPassword: resetPassword }
            : {}),
        });
      } catch (updateError) {
        // email claim leak nahos - update fail bhaye naya claim release garne
        if (emailChanged && linkedUser && !emailReleased) {
          await UserDirectoryService.releaseEmail(newEmail);
        }
        throw updateError;
      }
    } catch (exception) {
      next(exception);
    }
  };

  // yo function le employee delete garxa
  delete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid employee ID" };
      }

      const existing = await EmployeeService.getEmployeeById(id);

      if (!existing) {
        throw { code: 404, message: "Employee not found" };
      }

      // branch-scoped user le aafno branch ko matra delete garna pauxa
      assertInScope(
        (existing as any)?.branch?._id || (existing as any)?.branch,
        await getRequesterBranchId(req.loggedInUser),
      );

      // soft delete - history surakshit, removed employee report ma "Removed" highlight huncha
      const employee = await EmployeeService.softDeleteEmployee(id);

      // linked user account delete - login banda + email free (notification delete garna user id pahila liyeko)
      const foundUsers = await UserModel.find({ employee: id }).select("_id").lean();
      const userIds: mongoose.Types.ObjectId[] = foundUsers.map((u) => u._id);

      if (userIds.length > 0) {
        await NotificationModel.deleteMany({ user: { $in: userIds } });
      }
      // arko employee ko manager thiyo bhane unlink garne - dangling ref nagarne
      await EmployeeModel.updateMany({ manager: id }, { $unset: { manager: 1 } });
      // aru employee ko leave/correction aruko reviewer thiyo bhane pani unlink garne
      if (userIds.length > 0) {
        await LeaveRequestModel.updateMany(
          { reviewedBy: { $in: userIds } },
          { $unset: { reviewedBy: 1, reviewedAt: 1 } },
        );
        await AttendanceCorrectionModel.updateMany(
          { reviewedBy: { $in: userIds } },
          { $unset: { reviewedBy: 1, reviewedAt: 1 } },
        );
      }
      await UserModel.deleteMany({ employee: id });
      // linked login ko purano token pani dead hos
      userIds.forEach((uid) => invalidateUserSession(uid.toString()));

      // audit log - employee deleted
      AuditLogService.logAction(
        req.loggedInUser?._id?.toString(),
        "Employee Deleted",
        "employee",
        {
          targetId: id,
          oldData: { employeeId: (employee as any).employeeId, name: (employee as any).name },
          ipAddress: req.ip,
        },
      );

      res.json({
        data: null,
        message: "Employee deleted successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // admin/HR le employee ko profile photo upload garne
  uploadEmployeeImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid employee ID" };
      }

      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        throw { code: 422, message: "No file uploaded" };
      }

      if (!file.mimetype?.startsWith("image/")) {
        throw { code: 422, message: "Only image files are allowed" };
      }

      const employee: any = await EmployeeService.getEmployeeById(id);

      if (!employee) {
        throw { code: 404, message: "Employee not found" };
      }

      assertInScope(
        employee?.branch?._id || employee?.branch,
        await getRequesterBranchId(req.loggedInUser),
      );

      if (employee.profileImage) {
        await removeStoredFile(employee.profileImage);
      }

      const updated = await EmployeeService.updateEmployee(id, {
        profileImage: await saveUploadedFile(file, "profiles"),
      });

      res.json({
        data: updated,
        message: "Profile photo uploaded successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // admin/HR le employee ko profile photo hataune
  deleteEmployeeImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid employee ID" };
      }

      const employee: any = await EmployeeService.getEmployeeById(id);

      if (!employee) {
        throw { code: 404, message: "Employee not found" };
      }

      assertInScope(
        employee?.branch?._id || employee?.branch,
        await getRequesterBranchId(req.loggedInUser),
      );

      if (employee.profileImage) {
        await removeStoredFile(employee.profileImage);
      }

      const updated = await EmployeeService.updateEmployee(id, {
        profileImage: null,
      });

      res.json({
        data: updated,
        message: "Profile photo removed successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };
}

export default EmployeeController;