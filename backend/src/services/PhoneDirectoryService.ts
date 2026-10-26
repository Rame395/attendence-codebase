import mongoose from "mongoose";

import PhoneDirectoryModel from "../model/PhoneDirectoryModel.js";
import CompanyModel from "../model/CompanyModel.js";
import { getTenantModel } from "../config/tenant.js";

// central phone directory - email directory jastai phone uniqueness ko arbiter

function normalize(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

function isDuplicateKeyError(error: any): boolean {
  return error?.name === "MongoServerError" && error?.code === 11000;
}

// E11000 aayepachi holder ko friendly 409 banaune
async function duplicatePhoneHolderError(phone: string): Promise<{ code: number; message: string }> {
  const normalized = normalize(phone);
  try {
    const entry: any = await PhoneDirectoryModel.findOne({ phone: normalized }).lean();
    if (!entry) {
      return { code: 409, message: "This phone number is already in use. Please use a different phone number." };
    }
    let holder = normalized;
    if (entry.employeeId || entry.userId) {
      try {
        const E = getTenantModel(entry.dbName, "Employee");
        const doc: any = entry.employeeId
          ? await E.findById(entry.employeeId).select("name").lean().catch(() => null)
          : null;
        if (doc?.name) {
          holder = doc.name;
        } else if (entry.userId) {
          const U = getTenantModel(entry.dbName, "User");
          const u: any = await U.findById(entry.userId).select("username email").lean().catch(() => null);
          if (u) holder = u.username || u.email || holder;
        }
      } catch {
        // ignore
      }
    }
    let where = "";
    try {
      if (entry.dbName) {
        const company: any = await CompanyModel.findOne({ dbName: entry.dbName }).select("name").lean().catch(() => null);
        if (company?.name) where = ` (${company.name})`;
      }
    } catch {
      // ignore
    }
    return {
      code: 409,
      message: `This phone number is already in use by ${holder}${where}. Please use a different phone number.`,
    };
  } catch {
    return { code: 409, message: "This phone number is already in use. Please use a different phone number." };
  }
}

class PhoneDirectoryService {
  static normalize = normalize;

  static isDuplicateKeyError = isDuplicateKeyError;

  // phone claim - global lock, employee write bhandha aghi call
  static async claimPhone(data: {
    phone: string;
    dbName: string;
    userId?: mongoose.Types.ObjectId | string | null;
    employeeId?: mongoose.Types.ObjectId | string | null;
    company?: mongoose.Types.ObjectId | string | null;
  }): Promise<any> {
    const normalized = normalize(data.phone);
    try {
      return await PhoneDirectoryModel.create({
        phone: normalized,
        dbName: data.dbName,
        userId: (data.userId as any) || null,
        employeeId: (data.employeeId as any) || null,
        company: (data.company as any) || null,
      });
    } catch (error: any) {
      if (isDuplicateKeyError(error)) {
        throw await duplicatePhoneHolderError(normalized);
      }
      throw error;
    }
  }

  // claim rollback (employee create fail bhaye)
  static async releasePhone(phone: string): Promise<void> {
    try {
      await PhoneDirectoryModel.findOneAndDelete({ phone: normalize(phone) });
    } catch {
      // ignore
    }
  }

  // employee create pachi employee link confirm (best-effort)
  static async confirmEmployee(phone: string, employeeId: mongoose.Types.ObjectId | string): Promise<void> {
    try {
      await PhoneDirectoryModel.findOneAndUpdate(
        { phone: normalize(phone) },
        { employeeId: employeeId as any },
      );
    } catch {
      // ignore
    }
  }

  static async findByPhone(phone: string): Promise<any | null> {
    try {
      return await PhoneDirectoryModel.findOne({ phone: normalize(phone) }).lean();
    } catch {
      return null;
    }
  }

  static async countAll(): Promise<number> {
    try {
      return await PhoneDirectoryModel.countDocuments({});
    } catch {
      return 0;
    }
  }
}

export default PhoneDirectoryService;