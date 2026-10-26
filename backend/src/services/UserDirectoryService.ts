import mongoose from "mongoose";

import UserDirectoryModel from "../model/UserDirectoryModel.js";
import CompanyModel from "../model/CompanyModel.js";
import { getTenantModel } from "../config/tenant.js";

// central login directory - global email uniqueness ko arbiter

export interface DirectoryEntry {
  email: string;
  dbName: string;
  userId: mongoose.Types.ObjectId;
  company?: mongoose.Types.ObjectId | string | null;
  role?: string | null;
}

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

function isDuplicateKeyError(error: any): boolean {
  return error?.name === "MongoServerError" && error?.code === 11000;
}

function holderRoleLabel(role?: string | null): string {
  const map: Record<string, string> = {
    platform_admin: "Platform Admin",
    super_admin: "Super Admin",
    hr_admin: "HR Admin",
    manager: "Manager",
    employee: "Employee",
  };
  return (role && map[role]) || "user";
}

// E11000 aayepachi holder ko friendly 409 banaune (registeruelsanga consistent)
async function duplicateHolderError(email: string): Promise<{ code: number; message: string }> {
  const normalized = normalize(email);
  try {
    const entry: any = await UserDirectoryModel.findOne({ email: normalized }).lean();
    if (!entry) {
      return { code: 409, message: "This email is already registered. Please use a different email." };
    }
    const [company, holderName] = await Promise.all([
      entry.company
        ? CompanyModel.findById(entry.company).select("name").lean().catch(() => null)
        : Promise.resolve(null),
      (async () => {
        try {
          const U = getTenantModel(entry.dbName, "User");
          const u: any = await U.findById(entry.userId).select("username employee email role").lean();
          if (!u) return entry.email;
          if (u.employee) {
            try {
              const Emp = getTenantModel(entry.dbName, "Employee");
              const emp: any = await Emp.findById(u.employee).select("name").lean();
              if (emp?.name) return emp.name;
            } catch {
              // ignore
            }
          }
          return u.username || u.email || normalized;
        } catch {
          return normalized;
        }
      })(),
    ]);
    const who = holderName || normalized;
    const where = (company as any)?.name ? ` (${holderRoleLabel(entry.role)}, ${(company as any).name})` : "";
    return {
      code: 409,
      message: `This email is already in use by ${who}${where}. Please use a different email.`,
    };
  } catch {
    return { code: 409, message: "This email is already registered. Please use a different email." };
  }
}

class UserDirectoryService {
  static normalize = normalize;

  static isDuplicateKeyError = isDuplicateKeyError;

  // email claim - global lock, tenant user create bhandha aghi call
  static async claimEmail(data: {
    email: string;
    dbName: string;
    userId: mongoose.Types.ObjectId | string;
    company?: mongoose.Types.ObjectId | string | null;
    role?: string | null;
  }): Promise<any> {
    const normalized = normalize(data.email);

    // platform admin env-based ho - usko email aru kasaile claim garna sakdaina
    const platformAdminEmail =
      (process.env.PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim();
    if (platformAdminEmail && normalized === platformAdminEmail) {
      throw {
        code: 409,
        message: "This email belongs to the Platform Admin. Please use a different email.",
      };
    }

    try {
      return await UserDirectoryModel.create({
        email: normalized,
        dbName: data.dbName,
        userId: data.userId,
        company: (data.company as any) || null,
        role: data.role || null,
      });
    } catch (error: any) {
      if (isDuplicateKeyError(error)) {
        throw await duplicateHolderError(normalized);
      }
      throw error;
    }
  }

  // tenant create pachi role confirm garne (panel display ko lagi)
  static async confirmEntry(email: string, data: { role?: string | null; userId?: mongoose.Types.ObjectId | string }): Promise<void> {
    try {
      await UserDirectoryModel.findOneAndUpdate(
        { email: normalize(email) },
        { ...(data.role !== undefined ? { role: data.role } : {}), ...(data.userId ? { userId: data.userId } : {}) },
      );
    } catch {
      // best-effort - login path self-heal garxa
    }
  }

  // claim rollback (tenant create fail bhaye)
  static async releaseEmail(email: string): Promise<void> {
    try {
      await UserDirectoryModel.findOneAndDelete({ email: normalize(email) });
    } catch {
      // ignore
    }
  }

  static async removeByEmail(email: string): Promise<void> {
    await this.releaseEmail(email);
  }

  static async removeByDbName(dbName: string): Promise<number> {
    try {
      const res = await UserDirectoryModel.deleteMany({ dbName });
      return (res as any)?.deletedCount ?? 0;
    } catch {
      return 0;
    }
  }

  static async removeByCompanyId(companyId: string): Promise<number> {
    try {
      const res = await UserDirectoryModel.deleteMany({ company: companyId as any });
      return (res as any)?.deletedCount ?? 0;
    } catch {
      return 0;
    }
  }

  static async findByEmail(email: string): Promise<any | null> {
    try {
      return await UserDirectoryModel.findOne({ email: normalize(email) }).lean();
    } catch {
      return null;
    }
  }

  static async countAll(): Promise<number> {
    try {
      return await UserDirectoryModel.countDocuments({});
    } catch {
      return 0;
    }
  }

  // per-company indexed user counts (central aggregation - tenant touch hudaina)
  static async countByDbName(): Promise<Record<string, number>> {
    try {
      const rows: any[] = await UserDirectoryModel.aggregate([
        { $group: { _id: "$dbName", users: { $sum: 1 } } },
      ]);
      const out: Record<string, number> = {};
      for (const r of rows) {
        if (r._id) out[r._id] = r.users;
      }
      return out;
    } catch {
      return {};
    }
  }

  // platform status panel - central-only, deep orphan check opt-in
  static async getStatus(opts: { deep?: boolean } = {}): Promise<{
    totalEntries: number;
    perCompany: Array<{
      companyId: string;
      name: string;
      code: string;
      dbName: string;
      status: string;
      directoryUsers: number;
    }>;
    unknownDbEntries: Array<{ email: string; dbName: string }>;
    orphanEntries?: Array<{ email: string; dbName: string; reason: string }>;
    computedAt: string;
  }> {
    const [companies, totalEntries, byDb, unknownDbEntries] = await Promise.all([
      CompanyModel.find({}).select("name code dbName status").sort({ createdAt: -1 }).lean(),
      this.countAll(),
      this.countByDbName(),
      UserDirectoryModel.find({}).select("email dbName").lean().then(async (all: any[]) => {
        const known = new Set<string>();
        try {
          const regs: any[] = await CompanyModel.find({}).select("dbName").lean();
          for (const c of regs) if (c.dbName) known.add(c.dbName);
        } catch {
          // ignore
        }
        return all.filter((e) => e.dbName && !known.has(e.dbName)).map((e) => ({ email: e.email, dbName: e.dbName }));
      }),
    ]);

    const perCompany = (companies as any[]).map((c) => ({
      companyId: c._id.toString(),
      name: c.name,
      code: c.code,
      dbName: c.dbName,
      status: c.status,
      directoryUsers: byDb[c.dbName] ?? 0,
    }));

    let orphanEntries: Array<{ email: string; dbName: string; reason: string }> | undefined;
    if (opts.deep) {
      orphanEntries = [];
      const entries: any[] = await UserDirectoryModel.find({}).select("email dbName userId").lean();
      for (const e of entries) {
        try {
          const U = getTenantModel(e.dbName, "User");
          const exists = await U.exists({ _id: e.userId });
          if (!exists) orphanEntries.push({ email: e.email, dbName: e.dbName, reason: "user doc missing in tenant DB" });
        } catch {
          orphanEntries.push({ email: e.email, dbName: e.dbName, reason: "tenant DB unreachable" });
        }
      }
    }

    return { totalEntries, perCompany, unknownDbEntries, ...(orphanEntries ? { orphanEntries } : {}), computedAt: new Date().toISOString() };
  }

  // full rebuild - tenant users scan garera directory sync garne
  static async rebuild(): Promise<{
    scannedUsers: number;
    upserted: number;
    healedStale: number;
    removedStale: number;
    conflicts: Array<{ email: string; keptDb: string; skippedDb: string }>;
  }> {
    const companies: any[] = await CompanyModel.find({}).select("dbName name").lean();
    let scannedUsers = 0;
    let upserted = 0;
    const conflicts: Array<{ email: string; keptDb: string; skippedDb: string }> = [];

    for (const c of companies) {
      let users: any[] = [];
      try {
        const U = getTenantModel(c.dbName, "User");
        users = await U.find({}).select("_id email role company").lean();
      } catch (error: any) {
        console.error(`[directory:rebuild] scan ${c.dbName} failed:`, error?.message || error);
        continue;
      }
      for (const u of users) {
        if (!u?.email) continue;
        scannedUsers += 1;
        const email = normalize(u.email);
        try {
          const existing: any = await UserDirectoryModel.findOne({ email }).lean();
          if (existing) {
            if (existing.dbName === c.dbName && String(existing.userId) === String(u._id)) continue;
            // conflict - pahila ko jitne
            conflicts.push({ email, keptDb: existing.dbName, skippedDb: c.dbName });
            continue;
          }
          await UserDirectoryModel.create({
            email,
            dbName: c.dbName,
            userId: u._id,
            company: (u.company as any) || null,
            role: (u.role as any) || null,
          });
          upserted += 1;
        } catch (error: any) {
          if (isDuplicateKeyError(error)) {
            const existing: any = await UserDirectoryModel.findOne({ email }).lean().catch(() => null);
            conflicts.push({ email, keptDb: existing?.dbName || "?", skippedDb: c.dbName });
          } else {
            console.error(`[directory:rebuild] upsert ${email} failed:`, error?.message || error);
          }
        }
      }
    }

    // stale entries - company registry ma nabhayeko dbName wala hataune
    const knownDb = new Set(companies.map((c) => c.dbName));
    const allEntries: any[] = await UserDirectoryModel.find({}).select("email dbName userId").lean();
    let healedStale = 0;
    let removedStale = 0;
    for (const e of allEntries) {
      if (!knownDb.has(e.dbName)) {
        await this.releaseEmail(e.email);
        removedStale += 1;
        continue;
      }
      // tenant user doc ajai chha ki chhaina verify garne
      try {
        const U = getTenantModel(e.dbName, "User");
        const exists = await U.exists({ _id: e.userId });
        if (!exists) {
          // stale entry matra hataune - re-hire scan le cover garisakyo
          await this.releaseEmail(e.email);
          healedStale += 1;
        }
      } catch {
        // DB unreachable - nachune (false cleanup nahos)
      }
    }

    return { scannedUsers, upserted, healedStale, removedStale, conflicts };
  }
}

export default UserDirectoryService;
