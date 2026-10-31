import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";

import MailService from "./MailService.js";
import CompanyService from "./CompanyService.js";
import UserDirectoryService from "./UserDirectoryService.js";
import PhoneDirectoryService from "./PhoneDirectoryService.js";
import { removeStoredFile, saveUploadedFile } from "../utils/fileStorage.js";
import { CENTRAL_DB_NAME, getTenantModel } from "../config/tenant.js";
import { currentDbName } from "../config/tenantStore.js";
import { invalidateUserSession } from "../utils/authCache.js";
import CompanyModel from "../model/CompanyModel.js";
import { generateTemporaryPassword } from "../utils/generatePassword.js";



import EmployeeModel from "../model/EmployeeModel.js";
import UserModel from "../model/UserModel.js";
import DepartmentModel from "../model/DepartmentModel.js";
import BranchModel from "../model/BranchModel.js";
import EmployeeService from "./EmployeeService.js";
import AuditLogService from "./AuditLogService.js";
import { UserRole } from "../types/index.js";

class AuthService {

  // login

  // timing-safe string compare (platform password check ko lagi)
  private static safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  }

  static async login(
    email: string,
    password: string,
  ) {

    const normalizedEmail = email.toLowerCase();

    // platform admin - env credentials bata (trim garinxa)
    const platformEmail = (process.env.PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim();
    const platformPassword = (process.env.PLATFORM_ADMIN_PASSWORD || "").trim();
    if (platformEmail && normalizedEmail === platformEmail) {
      if (!platformPassword || !this.safeEqual(password, platformPassword)) {
        throw {
          code: 422,
          message: "Invalid email or password",
        };
      }

      const accessToken = jwt.sign(
        {
          sub: "platform-admin",
          role: "platform_admin",
          email: normalizedEmail,
          name: "Platform Admin",
          mustChangePassword: false,
          companyDb: CENTRAL_DB_NAME,
          company: null,
          permissions: [],
        },
        process.env.JWT_SECRET as string,
        {
          expiresIn: "1d",
        },
      );

      return {
        accessToken,

        user: {
          id: "platform-admin",
          email: normalizedEmail,
          name: "Platform Admin",
          role: "platform_admin",
          employee: null,
          status: "active",
          mustChangePassword: false,
          companyId: null,
          companyDb: CENTRAL_DB_NAME,
          permissions: [],
        },
      };
    }

    // company user login - kun company database ma chha khojne
    const located = await CompanyService.locateUserByEmail(normalizedEmail);
    if (!located) {
      throw {
        code: 422,
        message: "Invalid email or password",
      };
    }

    const dbName = located.dbName;

    // company deactivate bhaye login banda
    if (located.company.status !== "active") {
      throw {
        code: 403,
        message: "Your company account is deactivated. Contact system administrator.",
      };
    }

    const TenantUserModel = getTenantModel(dbName, "User");

    // directory bata userId chaina bhane direct fetch, natra legacy lookup
    const user = (located as any).userId
      ? await TenantUserModel.findById((located as any).userId)
      : await TenantUserModel.findOne({
        email: email.toLowerCase(),
      });

    if (!user) {
      throw {
        code: 422,
        message: "Invalid email or password",
      };
    }

    // company deactivate bhaye login banda
    if ((user as any).company) {
      const company: any = await CompanyModel.findById((user as any).company)
        .select("status name")
        .lean();
      if (!company || company.status !== "active") {
        throw {
          code: 403,
          message: "Your company account is deactivated. Contact system administrator.",
        };
      }
    }

    // Check account status
    if (user.status !== "active") {
      throw {
        code: 403,
        message: "Your account is inactive",
      };
    }

    // Check password
    const passwordMatched = await bcrypt.compare(
      password,
      user.password,
    );

    if (!passwordMatched) {
      throw {
        code: 422,
        message: "Invalid email or password",
      };
    }

    // Update last login
    user.lastLoginAt = new Date();

    await user.save();

    // JWT companyDb claim le request routing fix garxa
    const accessToken = jwt.sign(
      {
        sub: user._id.toString(),
        role: user.role,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
        tv: (user as any).tokenVersion ?? 0,
        companyDb: dbName,
        company: user.company ? user.company.toString() : null,
        permissions: user.permissions || [],
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "1d",
      },
    );

    return {
      accessToken,

      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        employee: user.employee,
        status: user.status,
        mustChangePassword:
          user.mustChangePassword,
        companyId: user.company ? user.company.toString() : null,
        companyDb: dbName,
        permissions: user.permissions || [],
      },
    };
  }


  // create user

  static async createUser(
    data: {
      name: string;
      email: string;
      username?: string | null;
      phone: string;
      employeeId: string;
      role: UserRole;
      gender?: string | null;
      department?: string | null;
      designation?: string | null;
      branch?: string | null;
      manager?: string | null;
      joiningDate?: string | null;
      departmentName?: string | null;
      branchName?: string | null;
      companyId?: string | null;
    },
    createdBy?: string,
  ) {

    // central (platform) DB ma company user banauna didaina
    const ambientDb = currentDbName() || CENTRAL_DB_NAME;
    if (ambientDb === CENTRAL_DB_NAME && !data.companyId) {
      throw {
        code: 422,
        message: "Choose a company first - users can only be created inside a company",
      };
    }

    // Check user email - if an existing user in this company (e.g. Owner / super_admin)
    // does not have an active Employee record linked yet, allow creating & linking their Employee profile!
    const existingUser: any =
      await UserModel.findOne({
        email: data.email.toLowerCase(),
      });

    let linkingExistingUser = false;
    if (existingUser) {
      if (existingUser.employee) {
        const linkedEmp = await EmployeeModel.findOne({
          _id: existingUser.employee,
          isDeleted: { $ne: true },
        });
        if (linkedEmp) {
          throw {
            code: 409,
            message: "Email already registered",
          };
        }
      }
      linkingExistingUser = true;
    }

    // username unique chahiyo - collision ma number append
    const trimmedUsername =
      data.username?.trim() || null;

    let username: string | null = trimmedUsername;
    if (username) {
      let candidate = username;
      let suffix = 1;
      while (true) {
        const existingUsername: any =
          await UserModel.findOne({
            username: candidate,
          });
        if (!existingUsername || (linkingExistingUser && String(existingUsername._id) === String(existingUser._id))) {
          break;
        }
        candidate = `${username}-${suffix}`;
        suffix += 1;
      }
      username = candidate;
    }

    // email globally free chha ki chhaina - directory check (skip if linking to existing tenant user)
    if (!linkingExistingUser) {
      await CompanyService.assertEmailAvailable(data.email);
    }

    // Check employee - removed (soft deleted) records sanga clash hudaina
    const existingEmployee =
      await EmployeeModel.findOne({
        isDeleted: { $ne: true },
        $or: [
          {
            email: data.email.toLowerCase(),
          },
          {
            employeeId: data.employeeId,
          },
        ],
      });

    if (existingEmployee) {
      throw {
        code: 409,
        message:
          "Employee email or Employee ID already exists",
      };
    }

    // re-hire: removed employee ko email/ID free garaune
    const removedClashes = await EmployeeModel.find({
      isDeleted: true,
      $or: [
        { email: data.email.toLowerCase() },
        { employeeId: data.employeeId },
      ],
    });

    for (let i = 0; i < removedClashes.length; i++) {
      const old = removedClashes[i];
      const stamp = `${Date.now().toString(36).toUpperCase()}${i}`;
      if (old.email === data.email.toLowerCase()) {
        old.email = `${data.email.toLowerCase()}+removed-${stamp}`;
      }
      if (old.employeeId === data.employeeId) {
        old.employeeId = `${data.employeeId}-R${stamp}`;
      }
      await old.save();
    }

    // Generate temporary password
    const temporaryPassword =
      generateTemporaryPassword();

    // Hash password
    const hashedPassword =
      await bcrypt.hash(
        temporaryPassword,
        12,
      );

    let department = data.department || null;
    let branch = data.branch || null;

    if (!department && data.departmentName?.trim()) {
      const departmentName =
        data.departmentName.trim();

      const departmentCode =
        departmentName
          .replace(/[^a-z0-9]/gi, "")
          .slice(0, 12)
          .toUpperCase() ||
        `DEP${Date.now()}`;

      const departmentDoc =
        await DepartmentModel.findOneAndUpdate(
          { name: departmentName },
          {
            $setOnInsert: {
              name: departmentName,
              code: departmentCode,
              createdBy,
            },
          },
          {
            new: true,
            upsert: true,
          },
        );

      department =
        departmentDoc._id.toString();
    }

    if (!branch && data.branchName?.trim()) {
      const branchName =
        data.branchName.trim();

      const branchCode =
        branchName
          .replace(/[^a-z0-9]/gi, "")
          .slice(0, 12)
          .toUpperCase() ||
        `BR${Date.now()}`;

      const branchDoc =
        await BranchModel.findOneAndUpdate(
          { name: branchName },
          {
            $setOnInsert: {
              name: branchName,
              code: branchCode,
              address: branchName,
              createdBy,
            },
          },
          {
            new: true,
            upsert: true,
          },
        );

      branch =
        branchDoc._id.toString();
    }

    // Create employee + user (fail bhaye claim rollback)
    const targetDb = currentDbName() || CENTRAL_DB_NAME;
    const newUserId = linkingExistingUser ? existingUser._id : new mongoose.Types.ObjectId();
    if (!linkingExistingUser) {
      await UserDirectoryService.claimEmail({
        email: data.email,
        dbName: targetDb,
        userId: newUserId,
        company: (data.companyId as any) || null,
        role: data.role,
      });
    }

    // phone global lock - create fail bhaye release
    let phoneNewlyClaimed = false;
    if (data.phone) {
      const existingPhone = await PhoneDirectoryService.findByPhone(data.phone);
      const ownedBySameTenantOrUser =
        existingPhone &&
        existingPhone.dbName === targetDb &&
        (!existingPhone.employeeId || (linkingExistingUser && String(existingPhone.userId) === String(existingUser._id)));

      if (!ownedBySameTenantOrUser) {
        await PhoneDirectoryService.claimPhone({
          phone: data.phone,
          dbName: targetDb,
          userId: newUserId,
          employeeId: null,
          company: (data.companyId as any) || existingUser?.company || null,
        });
        phoneNewlyClaimed = true;
      }
    }

    let employee: any;
    let user: any;
    try {
      // manager valid manager-role employee matra assign hunxa
      const resolvedManager = await EmployeeService.resolveValidManager(data.manager);

      // Create employee
      employee =
        await EmployeeModel.create({
          employeeId: data.employeeId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          gender: (data.gender as "male" | "female" | "other") || null,
          department,
          designation: data.designation || null,
          branch,
          manager: resolvedManager,
          joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
          status: "active",
          createdBy,
        });

      if (linkingExistingUser) {
        existingUser.employee = employee._id;
        if (!existingUser.username && username) {
          existingUser.username = username;
        }
        // Keep super_admin role intact if Owner is creating their own employee profile
        if (existingUser.role !== "super_admin" && data.role) {
          existingUser.role = data.role;
        }
        await existingUser.save();
        user = existingUser;
        invalidateUserSession(String(existingUser._id));
      } else {
        // username chha bhane matra save garne (sparse unique index)
        user =
          await UserModel.create({
            _id: newUserId,

            email: data.email.toLowerCase(),

            ...(username
              ? { username }
              : {}),

            password: hashedPassword,

            role: data.role,

            employee: employee._id,

            company: (data.companyId as any) || null,

            status: "active",

            createdBy,

            mustChangePassword: true,
          });
      }
    } catch (createError) {
      if (!linkingExistingUser) {
        await UserDirectoryService.releaseEmail(data.email);
      }
      if (data.phone && phoneNewlyClaimed) await PhoneDirectoryService.releasePhone(data.phone);
      throw createError;
    }

    // directory role confirm (claim ma diisakeko - best-effort sync)
    await UserDirectoryService.confirmEntry(data.email, {
      role: linkingExistingUser ? existingUser.role : data.role,
      userId: newUserId,
    });

    // phone entry ma employee id link
    if (data.phone && employee) {
      await PhoneDirectoryService.confirmEmployee(data.phone, employee._id);
    }

    // audit log - employee / user created
    await AuditLogService.logAction(
      createdBy?.toString() || user?._id?.toString(),
      data.role === "employee" ? "Employee Created" : "User Created",
      data.role === "employee" ? "employee" : "user",
      {
        targetId: (data.role === "employee" ? employee?._id : user?._id)?.toString(),
        employee: employee?._id?.toString(),
        newData: {
          employeeId: employee?.employeeId,
          name: employee?.name,
          email: data.email,
          role: data.role,
        },
      },
    );

    // Send email - skip welcome temp password email if linking to an existing active user account
    let emailSent = true;
    if (!linkingExistingUser) {
      try {
        await MailService.sendWelcomeEmail(
          data.email,
          data.name,
          temporaryPassword,
        );
      } catch (mailError: any) {
        emailSent = false;
        console.error("Welcome email failed:", mailError?.message || mailError);
      }
    }

    return {
      user,
      employee,
      emailSent,
      linkedExistingAccount: linkingExistingUser,
    };
  }


  // email change - naya random password banayera, changed (naya) email address ma matra pathaune.
  // yo email + password nai login credential ho, ra login pachi password change force huncha.
  static async resetUserCredentials(
    userId: string,
    opts: {
      newEmail?: string;
      name: string;
      updatedBy?: any;
      forceChange?: boolean;
    },
  ): Promise<{ user: any; emailSent: boolean; temporaryPassword: string }> {
    const user: any = await UserModel.findById(userId);
    if (!user) {
      throw { code: 404, message: "User not found" };
    }

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const updateData: Record<string, any> = {
      password: hashedPassword,
      mustChangePassword: opts.forceChange === true,
      updatedBy: opts.updatedBy || null,
    };
    if (opts.newEmail) {
      updateData.email = opts.newEmail.toLowerCase();
    }

    const updatedUser: any =
      await UserModel.findByIdAndUpdate(userId, { $set: updateData, $inc: { tokenVersion: 1 } }, {
        new: true,
        runValidators: true,
      }).select("-password -resetPasswordCode -resetPasswordExpires");
    // purano session (token) turuntai dead - naya login ma temp password + force change
    invalidateUserSession(userId);

    // credentials email SADAI changed email address ma matra pathaune (purano email ma kahiley hoina)
    let emailSent = true;
    try {
      const recipient = opts.newEmail?.toLowerCase() || user.email;
      await MailService.sendCredentialsResetEmail(
        recipient,
        opts.name,
        temporaryPassword,
      );
    } catch (mailError: any) {
      emailSent = false;
      console.error("Credentials email failed:", mailError?.message || mailError);
    }

    return { user: updatedUser, emailSent, temporaryPassword };
  }


  // get profile

  static async getProfile(userId: string) {
    // platform admin ko record database ma hudaina (env-based account)
    if (userId === "platform-admin") {
      const platformEmail =
        (process.env.PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim() || null;
      const platformName =
        (process.env.PLATFORM_ADMIN_NAME || "").trim() || "Platform Admin";
      return {
        _id: "platform-admin",
        email: platformEmail,
        username: platformName,
        role: "platform_admin",
        status: "active",
        mustChangePassword: false,
        calendarPreference: "bs",
        employee: null,
        companyId: null,
        company: null,
        permissions: [],
      };
    }

    const user: any = await UserModel.findById(userId)
      .select("-password -resetPasswordCode -resetPasswordExpires")
      .populate({
        path: "employee",
        select: "employeeId name email phone gender profileImage department designation branch joiningDate status",
        populate: [
          { path: "department", select: "name code" },
          { path: "designation", select: "name" },
          { path: "branch", select: "name code" },
        ],
      })
      .lean();

    if (!user) {
      throw {
        code: 404,
        message: "User not found",
      };
    }

    // company info + permissions - sidebar gating ra owner check ko lagi
    let company = null;
    if (user.company) {
      const companyDoc: any = await CompanyModel.findById(user.company)
        .select("name code status dbName logo createdAt")
        .lean();
      if (companyDoc) {
        company = {
          _id: companyDoc._id.toString(),
          name: companyDoc.name,
          code: companyDoc.code,
          status: companyDoc.status,
          logo: companyDoc.logo || null,
          createdAt: companyDoc.createdAt,
        };
      }
    }

    return {
      ...user,
      _id: user._id.toString(),
      companyId: user.company ? user.company.toString() : null,
      company,
      permissions: user.permissions || [],
    };
  }


  // change password

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (userId === "platform-admin") {
      throw {
        code: 422,
        message: "Platform admin password is managed via server settings",
      };
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      throw {
        code: 404,
        message: "User not found",
      };
    }

    const passwordMatched = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!passwordMatched) {
      throw {
        code: 422,
        message: "Current password is incorrect",
      };
    }

    // naya password purano sanga same huna paidaina (temporary reuse pani banda)
    const sameAsCurrent = await bcrypt.compare(newPassword, user.password);
    if (sameAsCurrent) {
      throw {
        code: 422,
        message: "New password must be different from the current password",
      };
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    // aru device/session ko purano token dead - afno lagi fresh token return
    user.tokenVersion = ((user as any).tokenVersion ?? 0) + 1;
    await user.save();
    invalidateUserSession(user._id.toString());

    const freshToken = jwt.sign(
      {
        sub: user._id.toString(),
        role: (user as any).role,
        email: (user as any).email,
        mustChangePassword: false,
        tv: (user as any).tokenVersion ?? 0,
        companyDb: currentDbName() || CENTRAL_DB_NAME,
        company: (user as any).company ? (user as any).company.toString() : null,
        permissions: (user as any).permissions || [],
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "1d",
      },
    );

    return { accessToken: freshToken };
  }


  // change first password

  static async changeFirstPassword(
    userId: string,
    newPassword: string,
  ) {
    if (userId === "platform-admin") {
      throw {
        code: 422,
        message: "Platform admin password is managed via server settings",
      };
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      throw {
        code: 404,
        message: "User not found",
      };
    }

    // sabai role lai matra hoina - mustChangePassword true wala lai matra
    if (!user.mustChangePassword) {
      throw {
        code: 400,
        message: "Password change is not required for this account",
      };
    }

    // temporary password nai feri rakhna paidaina - naya nai huna parcha
    const sameAsTemporary = await bcrypt.compare(newPassword, user.password);
    if (sameAsTemporary) {
      throw {
        code: 422,
        message: "New password must be different from the temporary password",
      };
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    user.tokenVersion = ((user as any).tokenVersion ?? 0) + 1;
    await user.save();
    invalidateUserSession(user._id.toString());

    // naya token - mustChangePassword false wala
    const accessToken = jwt.sign(
      {
        sub: user._id.toString(),
        role: user.role,
        email: user.email,
        mustChangePassword: false,
        tv: (user as any).tokenVersion ?? 0,
        companyDb: currentDbName() || CENTRAL_DB_NAME,
        company: (user as any).company ? (user as any).company.toString() : null,
        permissions: (user as any).permissions || [],
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "1d",
      },
    );

    return {
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        employee: user.employee,
        status: user.status,
        mustChangePassword: false,
      },
    };
  }


  // forgot password

  static async forgotPassword(
    email: string,
  ) {

    // platform admin ko password env bata manage huncha (mail flow chaina)
    const platformEmail = (process.env.PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim();
    if (platformEmail && email.toLowerCase() === platformEmail) {
      throw {
        code: 422,
        message: "Platform admin password is managed via server settings",
      };
    }

    // user kun company database ma chha khojne
    const located = await CompanyService.locateUserByEmail(email.toLowerCase());
    if (!located) {
      throw {
        code: 404,
        message: "Email is not registered",
      };
    }
    const TenantUserModel = getTenantModel(located.dbName, "User");

    const user =
      await TenantUserModel.findOne({
        email: email.toLowerCase(),
      });

    if (!user) {
      throw {
        code: 404,
        message: "Email is not registered",
      };
    }

    // Generate 6 digit code
    const code =
      crypto.randomInt(
        100000,
        999999,
      ).toString();

    user.resetPasswordCode = code;

    user.resetPasswordExpires =
      new Date(
        Date.now() + 10 * 60 * 1000,
      );

    await user.save();

    await MailService.sendForgotPasswordCode(
      user.email,
      code,
    );
  }


  // reset password

  static async resetPassword(
    email: string,
    code: string,
    password: string,
  ) {

    const located = await CompanyService.locateUserByEmail(email.toLowerCase());
    if (!located) {
      throw {
        code: 422,
        message: "Invalid or expired reset code",
      };
    }
    const TenantUserModel = getTenantModel(located.dbName, "User");

    const user =
      await TenantUserModel.findOne({
        email: email.toLowerCase(),

        resetPasswordCode: code,

        resetPasswordExpires: {
          $gt: new Date(),
        },
      });

    if (!user) {
      throw {
        code: 422,
        message:
          "Invalid or expired reset code",
      };
    }

    // purano password nai feri rakhna paidaina
    const sameAsCurrent = await bcrypt.compare(password, user.password);
    if (sameAsCurrent) {
      throw {
        code: 422,
        message: "New password must be different from the current password",
      };
    }

    // Hash new password
    user.password =
      await bcrypt.hash(
        password,
        12,
      );
    // Clear reset information
    user.resetPasswordCode = null;

    user.resetPasswordExpires = null;

    user.mustChangePassword = false;

    // purano session turuntai dead
    user.tokenVersion = ((user as any).tokenVersion ?? 0) + 1;

    await user.save();
    invalidateUserSession(user._id.toString());
  }


  // update own profile

  static async updateOwnProfile(
    userId: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      gender?: string;
      calendarPreference?: "bs" | "ad";
    },
  ) {
    if (userId === "platform-admin") {
      throw {
        code: 422,
        message: "Platform admin profile is managed via server settings",
      };
    }

    const user =
      await UserModel.findById(userId);

    if (!user) {
      throw {
        code: 404,
        message: "User not found",
      };
    }

    // email change - conflict check + central directory claim
    if (
      data.email &&
      data.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      const existing =
        await UserModel.findOne({
          email: data.email.toLowerCase(),
          _id: { $ne: userId },
        });

      if (existing) {
        throw {
          code: 409,
          message:
            "Email already in use by another account",
        };
      }

      const oldEmail = user.email;
      await UserDirectoryService.claimEmail({
        email: data.email,
        dbName: currentDbName() || CENTRAL_DB_NAME,
        userId: user._id,
        company: (user as any).company || null,
        role: (user as any).role || null,
      });
      try {
        user.email = data.email.toLowerCase();
        await user.save();
        // purano entry hataune (naya confirm bhaisakyo)
        await UserDirectoryService.releaseEmail(oldEmail);
      } catch (saveError) {
        await UserDirectoryService.releaseEmail(data.email);
        throw saveError;
      }
    }

    // employee record chaina bhane auto-create (default super admin ko lagi)
    let employee =
      user.employee
        ? await EmployeeModel.findById(user.employee)
        : null;

    // employee-less admin account (super_admin) ma username nai display name ho -
    // name change garda username pani sync garne (collision bhaye purano rahancha)
    if (!employee && data.name !== undefined && data.name.trim()) {
      const cleanName = data.name.trim();
      if (cleanName !== (user as any).username) {
        const clash = await UserModel.findOne({
          username: cleanName,
          _id: { $ne: userId },
        }).select("_id").lean();
        if (!clash) {
          (user as any).username = cleanName;
        }
      }
    }

    // phone unique - claim garera matra assign/update
    let claimedPhone: string | null = null;
    const oldPhone = employee?.phone?.trim?.() || "";
    if (data.phone !== undefined && data.phone.trim() !== oldPhone) {
      await PhoneDirectoryService.claimPhone({
        phone: data.phone.trim(),
        dbName: currentDbName() || CENTRAL_DB_NAME,
        userId: user._id,
        employeeId: (user as any).employee || null,
        company: (user as any).company || null,
      });
      claimedPhone = data.phone.trim();
    }

    try {
      if (!employee) {
        if (!data.name || !data.phone) {
          throw {
            code: 400,
            message:
              "Name and phone are required to create your profile",
          };
        }

        employee =
          await EmployeeModel.create({
            employeeId: `EMP-${Date.now().toString(36).toUpperCase()}`,
            name: data.name.trim(),
            email: user.email,
            phone: data.phone.trim(),
            gender: data.gender || null,
            status: "active",
            createdBy: userId,
            updatedBy: userId,
          } as never);

        user.employee = employee._id as typeof user.employee;
        await user.save();
      } else {
        if (data.name !== undefined) employee.name = data.name.trim();
        if (data.phone !== undefined) employee.phone = data.phone.trim();
        if (data.gender !== undefined)
          employee.gender = (data.gender || null) as "male" | "female" | "other" | null;
        if (data.email !== undefined) employee.email = data.email.toLowerCase();
        employee.updatedBy = userId as never;
        await employee.save();
      }

      // per-user calendar preference (profile bata update)
      if (
        data.calendarPreference === "bs" ||
        data.calendarPreference === "ad"
      ) {
        (user as any).calendarPreference = data.calendarPreference;
      }

      await user.save();

      // purano phone entry hataune (naya establish bhaisakyo)
      if (claimedPhone && oldPhone) {
        await PhoneDirectoryService.releasePhone(oldPhone);
      }
    } catch (saveError) {
      if (claimedPhone) {
        await PhoneDirectoryService.releasePhone(claimedPhone);
      }
      throw saveError;
    }

    // updated profile populate garera return
    return this.getProfile(userId);
  }

  // upload profile image

  static async uploadOwnProfileImage(
    userId: string,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw { code: 422, message: "No file uploaded" };
    }

    if (!file.mimetype?.startsWith("image/")) {
      throw { code: 422, message: "Only image files are allowed" };
    }

    if (userId === "platform-admin") {
      throw {
        code: 422,
        message: "Platform admin profile is managed via server settings",
      };
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      throw { code: 404, message: "User not found" };
    }

    // local disk (public/uploads/profiles) - fileStorage helper le handle garxa
    const imageData = await saveUploadedFile(file, "profiles");

    const employee = user.employee
      ? await EmployeeModel.findById(user.employee)
      : null;

    if (employee) {
      if ((employee as any).profileImage) {
        // purano photo disk bata hataune
        await removeStoredFile((employee as any).profileImage);
      }
      (employee as any).profileImage = imageData;
      await employee.save();
    } else {
      if ((user as any).profileImage) {
        await removeStoredFile((user as any).profileImage);
      }
      (user as any).profileImage = imageData;
      await user.save();
    }

    return this.getProfile(userId);
  }

  // delete profile image

  static async deleteOwnProfileImage(userId: string) {
    if (userId === "platform-admin") {
      throw {
        code: 422,
        message: "Platform admin profile is managed via server settings",
      };
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      throw { code: 404, message: "User not found" };
    }

    const employee = user.employee
      ? await EmployeeModel.findById(user.employee)
      : null;

    if (employee && (employee as any).profileImage) {
      await removeStoredFile((employee as any).profileImage);
      (employee as any).profileImage = null;
      await employee.save();
    } else if ((user as any).profileImage) {
      await removeStoredFile((user as any).profileImage);
      (user as any).profileImage = null;
      await user.save();
    }

    return this.getProfile(userId);
  }
}

export default AuthService;
