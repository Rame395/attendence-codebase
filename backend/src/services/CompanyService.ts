import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import CompanyModel from "../model/CompanyModel.js";
import {
  CENTRAL_DB_NAME,
  getTenantConnection,
  getTenantModel,
  noteTenantAdded,
  releaseTenantConnection,
} from "../config/tenant.js";
import { currentDbName } from "../config/tenantStore.js";
import { isValidPermission } from "../utils/permissions.js";
import { generateTemporaryPassword } from "../utils/generatePassword.js";
import { removeStoredFile, saveUploadedFile } from "../utils/fileStorage.js";
import MailService from "./MailService.js";
import UserDirectoryService from "./UserDirectoryService.js";
import {
  invalidateCompanyCache,
  invalidateUserPerms,
  invalidateUserSession,
} from "../utils/authCache.js";

// company (multi-tenant) service - central DB + har company kai aafnai DB
class CompanyService {

  // platform-admin sub ho - objectId cast error nagaros bhanera null garne
  private static actorId(id?: string | null): any {
    return id && /^[a-fA-F0-9]{24}$/.test(id) ? (id as any) : null;
  }

  // database naam banaune - central sanga judhna hudaina
  static buildDbName(code: string): string {
    const slug = code
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return `tenant-${slug || "company"}`;
  }

  // platform dashboard stats - companies overview + totals (owner only route)
  static async getPlatformStats() {
    const [companies, dirByDb, dirTotal] = await Promise.all([
      CompanyModel.find()
        .sort({ createdAt: -1 })
        .lean(),
      UserDirectoryService.countByDbName(),
      UserDirectoryService.countAll(),
    ]);

    let totalSuperAdmins = 0;
    let totalEmployees = 0;

    const perCompany = await Promise.all(
      companies.map(async (c) => {
        let superAdmins = 0;
        let employees = 0;
        try {
          const U = getTenantModel(c.dbName, "User");
          const E = getTenantModel(c.dbName, "Employee");
          [superAdmins, employees] = await Promise.all([
            U.countDocuments({ role: "super_admin" }),
            E.countDocuments({ isDeleted: { $ne: true } }),
          ]);
        } catch {
          // company db unreachable - 0 nai
        }
        totalSuperAdmins += superAdmins;
        totalEmployees += employees;
        return {
          _id: c._id,
          name: c.name,
          code: c.code,
          status: c.status,
          createdAt: c.createdAt,
          superAdmins,
          employees,
          directoryUsers: dirByDb[c.dbName] ?? 0,
        };
      }),
    );

    return {
      totalCompanies: companies.length,
      activeCompanies: companies.filter((c) => c.status === "active").length,
      suspendedCompanies: companies.filter((c) => c.status !== "active").length,
      totalSuperAdmins,
      totalEmployees,
      totalUsers: totalSuperAdmins + totalEmployees,
      directoryUsers: dirTotal,
      recentCompanies: perCompany.slice(0, 5),
    };
  }

  static async listCompanies() {
    const [companies, dirByDb] = await Promise.all([
      CompanyModel.find()
        .sort({ createdAt: -1 })
        .lean(),
      UserDirectoryService.countByDbName(),
    ]);

    // har company ko superadmin count (UI dashboard ko lagi)
    const withCounts = await Promise.all(
      companies.map(async (c) => {
        let superAdmins = 0;
        try {
          const UserModel = getTenantModel(c.dbName, "User");
          superAdmins = await UserModel.countDocuments({ role: "super_admin" });
        } catch {
          // company db connect fail - 0 nai dekhaune
        }
        return { ...c, superAdmins, directoryUsers: dirByDb[c.dbName] ?? 0 };
      }),
    );

    return withCounts;
  }

  static async getCompanyById(id: string) {
    const company = await CompanyModel.findById(id).lean();
    if (!company) {
      throw { code: 404, message: "Company not found" };
    }
    return company;
  }

  static async getCompanyByDbName(dbName: string) {
    return await CompanyModel.findOne({ dbName }).lean();
  }

  // naya company + DB provision garne, superadmin diye create pani
  static async createCompany(
    data: {
      name: string;
      code: string;
      status?: "active" | "inactive";
      superadmin?: {
        name: string;
        email: string;
        permissions: string[];
      } | null;
    },
    createdBy?: string,
  ) {
    const code = data.code.trim().toUpperCase();

    const existing = await CompanyModel.findOne({
      $or: [{ code }, { name: data.name.trim() }],
    }).lean();
    if (existing) {
      throw {
        code: 409,
        message: "Company name or code already exists",
      };
    }

    const dbName = this.buildDbName(code);
    if (dbName === CENTRAL_DB_NAME) {
      throw {
        code: 422,
        message: "This company code is reserved, use another code",
      };
    }
    const dbTaken = await CompanyModel.findOne({ dbName }).lean();
    if (dbTaken) {
      throw {
        code: 409,
        message: "Company database already exists, use another code",
      };
    }

    const company: any = await CompanyModel.create({
      name: data.name.trim(),
      code,
      dbName,
      status: data.status || "active",
      createdBy: this.actorId(createdBy),
    });

    // database provision - connection + default settings seed
    try {
      getTenantConnection(dbName);
      const CompanySettingModel = getTenantModel(dbName, "CompanySetting");
      await CompanySettingModel.findOneAndUpdate(
        {},
        { $setOnInsert: { companyName: company.name } },
        { upsert: true, returnDocument: "after" },
      );
    } catch (provisionError: any) {
      // provision fail bhaye company record pani rollback garne
      await CompanyModel.findByIdAndDelete(company._id);
      throw {
        code: 500,
        message: provisionError?.message || "Failed to provision company database",
      };
    }

    // inline superadmin create - temp password mail ma, fail bhaye rollback
    let superAdmin = null;
    let emailSent = false;
    let temporaryPassword: string | null = null;
    if (data.superadmin) {
      try {
        const created = await this.createSuperAdminInTenant(company, {
          name: data.superadmin.name,
          email: data.superadmin.email,
          permissions: data.superadmin.permissions,
        }, createdBy);
        superAdmin = created.user;
        emailSent = created.emailSent;
        temporaryPassword = created.temporaryPassword;
      } catch (superAdminError: any) {
        await CompanyModel.findByIdAndDelete(company._id);
        // directory claim pani rollback (stale entry le email block nagaros)
        try {
          if (data.superadmin?.email) {
            await UserDirectoryService.releaseEmail(data.superadmin.email);
          }
        } catch {
          // ignore
        }
        try {
          await releaseTenantConnection(dbName);
        } catch {
          // ignore
        }
        throw superAdminError;
      }
    }

    noteTenantAdded(dbName);

    return { company, superAdmin, emailSent, temporaryPassword };
  }

  static async updateCompany(
    id: string,
    data: { name?: string; status?: string },
    updatedBy?: string,
  ) {
    const company: any = await CompanyModel.findById(id);
    if (!company) {
      throw { code: 404, message: "Company not found" };
    }

    // central/default company ko dbName ra code change garna didaina
    if (data.name !== undefined) {
      const clash: any = await CompanyModel.findOne({
        _id: { $ne: id },
        name: data.name.trim(),
      }).lean();
      if (clash) {
        throw { code: 409, message: "Company name already exists" };
      }
      company.name = data.name.trim();
    }
    if (data.status !== undefined) company.status = data.status;
    company.updatedBy = this.actorId(updatedBy);
    await company.save();

    // cached company status (AuthMiddleware) turuntai refresh hos
    invalidateCompanyCache(company._id.toString(), company.dbName);

    return company;
  }

  // company ko superadmin haru (company database bata)
  static async listCompanySuperAdmins(companyId: string) {
    const company: any = await this.getCompanyById(companyId);
    const UserModel = getTenantModel(company.dbName, "User");
    return await UserModel.find({ role: "super_admin" })
      .select("-password -resetPasswordCode -resetPasswordExpires")
      .sort({ createdAt: -1 })
      .lean();
  }

  // superadmin banaune - sidebar ticks sahit, yeauta matra
  static async createCompanySuperAdmin(
    companyId: string,
    data: {
      name: string;
      email: string;
      permissions: string[];
    },
    createdBy?: string,
  ) {
    const company: any = await this.getCompanyById(companyId);
    if (company.status !== "active") {
      throw { code: 422, message: "Company is deactivated" };
    }

    const created = await this.createSuperAdminInTenant(company, data, createdBy);
    return {
      user: created.user,
      emailSent: created.emailSent,
      temporaryPassword: created.temporaryPassword,
    };
  }

  // tenant DB vitra superadmin create (temp password mail ma pathaincha)
  static async createSuperAdminInTenant(
    company: any,
    data: {
      name: string;
      email: string;
      permissions: string[];
    },
    createdBy?: string,
  ): Promise<{ user: any; temporaryPassword: string; emailSent: boolean }> {
    const email = data.email.toLowerCase();
    const permissions = [...new Set(data.permissions.filter(isValidPermission))];

    const UserModel = getTenantModel(company.dbName, "User");

    // email globally free chha ki chhaina (stale entry self-heal sahit)
    await this.assertEmailAvailable(email);

    // yeauta company ko yeauta matra superadmin
    const existingCount = await UserModel.countDocuments({ role: "super_admin" });
    if (existingCount > 0) {
      throw {
        code: 409,
        message: "This company already has a super admin. Edit or remove it first.",
      };
    }

    // project kai random temporary password - first login ma change garna parcha
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    // central directory ma email claim (concurrent create race safe)
    const newUserId = new mongoose.Types.ObjectId();
    await UserDirectoryService.claimEmail({
      email,
      dbName: company.dbName,
      userId: newUserId,
      company: company._id,
      role: "super_admin",
    });

    let user: any;
    try {
      user = await UserModel.create({
        _id: newUserId,
        email,
        username: data.name.trim(),
        password: hashedPassword,
        role: "super_admin",
        company: company._id,
        permissions,
        status: "active",
        createdBy: this.actorId(createdBy),
        mustChangePassword: true,
      });
    } catch (createError) {
      // tenant create fail bhaye claim pani rollback (orphan entry nahos)
      await UserDirectoryService.releaseEmail(email);
      throw createError;
    }

    // login credentials email ma - fail bhaye pani account creation fail hudaina
    let emailSent = true;
    try {
      await MailService.sendWelcomeEmail(email, data.name.trim(), temporaryPassword);
    } catch (mailError: any) {
      emailSent = false;
      console.error("Welcome email failed:", mailError?.message || mailError);
    }

    return { user, temporaryPassword, emailSent };
  }

  // company logo upload/remove garne (getCompanyById lean dincha - update query nai)
  static async uploadCompanyLogo(companyId: string, file: Express.Multer.File) {
    const company: any = await this.getCompanyById(companyId);
    if (!file) {
      throw { code: 422, message: "No file uploaded" };
    }
    if (!file.mimetype?.startsWith("image/")) {
      throw { code: 422, message: "Only image files are allowed" };
    }
    if (company.logo) {
      await removeStoredFile(company.logo);
    }
    const logo = await saveUploadedFile(file, "companies");
    return await CompanyModel.findByIdAndUpdate(
      companyId,
      { logo },
      { new: true },
    );
  }

  static async deleteCompanyLogo(companyId: string) {
    const company: any = await this.getCompanyById(companyId);
    if (company.logo) {
      await removeStoredFile(company.logo);
      return await CompanyModel.findByIdAndUpdate(
        companyId,
        { logo: null },
        { new: true },
      );
    }
    return company;
  }

  // superadmin ko ticks (permissions) / status update garne
  static async updateCompanySuperAdmin(
    companyId: string,
    userId: string,
    data: { permissions?: string[]; status?: string },
  ) {
    const company: any = await this.getCompanyById(companyId);
    const UserModel = getTenantModel(company.dbName, "User");

    const user: any = await UserModel.findOne({ _id: userId, role: "super_admin" });
    if (!user) {
      throw { code: 404, message: "Super admin not found" };
    }

      if (data.permissions !== undefined) {
        user.permissions = [...new Set(data.permissions.filter(isValidPermission))];
      }
    if (data.status !== undefined) user.status = data.status;
    await user.save();

    // cached permissions + session turuntai refresh hos (block pani turuntai lagu huncha)
    invalidateUserPerms(company.dbName, user._id.toString());
    invalidateUserSession(user._id.toString());

    return user;
  }

  // company superadmin hataune (login banda - user doc nai janchha)
  static async deleteCompanySuperAdmin(companyId: string, userId: string) {
    const company: any = await this.getCompanyById(companyId);
    const UserModel = getTenantModel(company.dbName, "User");

    const user: any = await UserModel.findOne({ _id: userId, role: "super_admin" });
    if (!user) {
      throw { code: 404, message: "Super admin not found" };
    }

    await UserModel.findByIdAndDelete(userId);

    invalidateUserPerms(company.dbName, userId);
    // delete pachi purano token pani dead
    invalidateUserSession(userId);

    // central directory bata pani hataune (email reuse huna paos)
    if (user?.email) {
      await UserDirectoryService.removeByEmail(user.email);
    }

    return true;
  }

  // company delete - central DB didaina, tenant DB + logo + records hataune
  static async deleteCompany(id: string) {
    const company: any = await this.getCompanyById(id);

    if (company.dbName === CENTRAL_DB_NAME) {
      throw {
        code: 403,
        message: "The default company database cannot be deleted",
      };
    }

    // company logo file pani hataune (local uploads)
    if (company.logo) {
      await removeStoredFile(company.logo);
    }

    // tenant DB hataune - drop mile drop, natra wipe (asPromise pachi)
    try {
      const conn = getTenantConnection(company.dbName);
      try {
        await conn.asPromise();
      } catch {
        // connect nai bhaena - tala db null check le handle garxa
      }
      const tenantDb = conn.db;
      if (tenantDb) {
        try {
          await tenantDb.dropDatabase();
        } catch {
          const collections = await tenantDb.listCollections().toArray();
          for (const c of collections) {
            try {
              await tenantDb.collection(c.name).drop();
            } catch {
              await tenantDb.collection(c.name).deleteMany({});
            }
          }
        }
      } else {
        console.error(`Company DB removal skipped (${company.dbName}): no database handle`);
      }
    } catch (wipeError: any) {
      console.error("Company DB removal failed:", wipeError?.message || wipeError);
    }

    // connection cache bata pani hataune (purge bhayeko DB ma write nahos)
    try {
      await releaseTenantConnection(company.dbName);
    } catch {
      // ignore
    }

    await CompanyModel.findByIdAndDelete(id);

    // cached company status turuntai hataune - purano token le chalna napaos
    invalidateCompanyCache(id, company.dbName);

    // central directory entries pani hataune (tyo company ko sabai emails free)
    await UserDirectoryService.removeByDbName(company.dbName);
    await UserDirectoryService.removeByCompanyId(id);

    return true;
  }

  // boot seed

  // central ma companies collection + unique index matra init
  static async initCompaniesCollection() {
    await CompanyModel.init();
    // login directory ko unique index pani ensure garne (global email lock)
    const { default: UserDirectoryModel } = await import("../model/UserDirectoryModel.js");
    await UserDirectoryModel.init();
  }

  // current request kun company ma chha (controller/service helper)
  static currentCompanyDb(): string {
    return currentDbName() || CENTRAL_DB_NAME;
  }

  private static holderRoleLabel(role?: string | null): string {
    const map: Record<string, string> = {
      platform_admin: "Platform Admin",
      super_admin: "Super Admin",
      hr_admin: "HR Admin",
      manager: "Manager",
      employee: "Employee",
    };
    return (role && map[role]) || "user";
  }

  // email globally free check - directory fast path, miss bhaye scan
  static async assertEmailAvailable(email: string) {
    const normalized = email.toLowerCase();

    // platform admin email nai ho bhane
    const platformEmail = (process.env.PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim();
    if (platformEmail && normalized === platformEmail) {
      throw {
        code: 409,
        message: "This email belongs to the Platform Admin. Please use a different email.",
      };
    }

    const holder = await this.locateUserByEmail(normalized);
    if (!holder) return;

    const who =
      holder.user.employee?.name ||
      holder.user.username ||
      holder.user.email ||
      normalized;
    throw {
      code: 409,
      message: `This email is already in use by ${who} (${this.holderRoleLabel(holder.user.role)}, ${holder.company.name}). Please use a different email.`,
    };
  }

  // email kun company DB ma chha khojne (fast path + legacy scan fallback)
  static async locateUserByEmail(
    email: string,
  ): Promise<{ dbName: string; company: any; user: any; userId?: string } | null> {
    const normalized = email.toLowerCase();

    // ---- fast path: central directory ----
    try {
      const entry = await UserDirectoryService.findByEmail(normalized);
      if (entry?.dbName) {
        const company: any = await CompanyModel.findOne({ dbName: entry.dbName })
          .select("dbName name code status")
          .lean();
        if (company) {
          try {
            const U = getTenantModel(entry.dbName, "User");
            const user: any = await U.findOne({ _id: entry.userId })
              .select("role username employee email")
              .lean();
            if (user) {
              if (user.employee) {
                try {
                  const Emp = getTenantModel(entry.dbName, "Employee");
                  const emp: any = await Emp.findById(user.employee)
                    .select("name email")
                    .lean();
                  user.employee = emp || null;
                } catch {
                  user.employee = null;
                }
              }
              return { dbName: entry.dbName, company, user, userId: String(entry.userId) };
            }
            // stale entry (user doc chaina) - hataune, scan ma fallthrough
            await UserDirectoryService.releaseEmail(normalized);
          } catch {
            // tenant DB error - scan ma fallthrough (fail-closed hoina)
          }
        } else {
          // company registry ma chaina - stale entry hataune
          await UserDirectoryService.releaseEmail(normalized);
        }
      }
    } catch {
      // directory error - scan ma fallthrough
    }

    // ---- fallback: legacy full scan (self-heal sahit) ----
    const companies: any[] = await CompanyModel.find({})
      .select("dbName name code status")
      .lean();

    const checks = await Promise.all(
      companies.map(async (c) => {
        try {
          const U = getTenantModel(c.dbName, "User");
          const user: any = await U.findOne({ email: normalized })
            .select("role username employee email")
            .lean();
          if (!user) return null;
          // employee name chahine - populate chaina, model directly resolve
          if (user.employee) {
            const Emp = getTenantModel(c.dbName, "Employee");
            const emp: any = await Emp.findById(user.employee)
              .select("name email")
              .lean();
            user.employee = emp || null;
          }
          return { dbName: c.dbName, company: c, user, userId: String(user._id) };
        } catch (error) {
          // DB error log garera check kaa fail bhayo dekhaune
          console.error(
            `[locateUserByEmail] ${email} in ${c.dbName}:`,
            (error as any)?.message || error,
          );
          return null;
        }
      }),
    );

    const found: any = checks.find(Boolean) || null;
    // self-heal: scan le bheteko entry directory ma pani rakne
    if (found) {
      try {
        await UserDirectoryService.claimEmail({
          email: normalized,
          dbName: found.dbName,
          userId: found.user?._id,
          company: found.company?._id || null,
          role: found.user?.role || null,
        });
      } catch {
        // conflict (race) - directory ko jitne, ignore
      }
      return { dbName: found.dbName, company: found.company, user: found.user, userId: String(found.user?._id || "") };
    }
    return null;
  }

  // user create kun company target garne - aafnai default, arko owner matra
  static async resolveTargetTenant(req: any): Promise<{
    targetCompany: string | null;
    targetDb: string;
  }> {
    const callerCompany = req.loggedInUser?.company || null;
    const callerDb = req.loggedInUser?.companyDb || CENTRAL_DB_NAME;
    const companyId = req.body?.companyId;

    if (companyId && companyId !== callerCompany) {
      const callerDbIsCentral =
        !req.loggedInUser?.companyDb ||
        req.loggedInUser?.companyDb === CENTRAL_DB_NAME;
      if (req.loggedInUser?.role !== "super_admin" || !callerDbIsCentral) {
        throw {
          code: 403,
          message: "You cannot create users for another company",
        };
      }
      const target: any = await this.getCompanyById(companyId);
      return {
        targetCompany: target._id.toString(),
        targetDb: target.dbName,
      };
    }

    return { targetCompany: callerCompany, targetDb: callerDb };
  }
}

export default CompanyService;
