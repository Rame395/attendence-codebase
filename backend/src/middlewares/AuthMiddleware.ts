import type { Response, NextFunction } from "express";
import mongoose from "mongoose";
import type { UserRole } from "../types/index.js";
import CompanyModel from "../model/CompanyModel.js";
import UserModel from "../model/UserModel.js";
import { CENTRAL_DB_NAME, getTenantModel } from "../config/tenant.js";
import { getVerifiedAuth } from "../utils/requestAuth.js";
import {
  getCachedCompanyStatusByDbName,
  getCachedCompanyStatusById,
  getCachedUserSession,
} from "../utils/authCache.js";

// factory function - JWT verify tenantContext le garxa, company status TTL-cached
const checkLogin = () => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const { token, decoded, error } = getVerifiedAuth(req);

      if (!token) {
        return next({ code: 401, message: "Login required" });
      }

      if (error || !decoded) {
        return next({ code: 401, message: "Invalid or expired token" });
      }

      const {
        sub,
        role,
        email,
        mustChangePassword,
        tv,
        companyDb,
        company,
      }: {
        sub: string;
        role: UserRole;
        email: string;
        mustChangePassword?: boolean;
        tv?: number;
        companyDb?: string;
        company?: string | null;
      } = decoded as any;

      // company delete/deactivate pachi purano token chalna napaos (TTL-cached, legacy dbName bata check)
      if (!company && companyDb && companyDb !== CENTRAL_DB_NAME) {
        const legacyCompany = await getCachedCompanyStatusByDbName(companyDb, () =>
          CompanyModel.findOne({
            dbName: companyDb,
          })
            .select("status")
            .lean(),
        );
        if (!legacyCompany.exists) {
          return next({
            code: 401,
            message: "Session expired. Please login again.",
          });
        }
        if (legacyCompany.status !== "active") {
          return next({
            code: 403,
            message: "Your company account is deactivated. Contact system administrator.",
          });
        }
      }
      if (company) {
        const companyStatus = await getCachedCompanyStatusById(company, () =>
          CompanyModel.findById(company).select("status").lean(),
        );
        if (!companyStatus.exists) {
          return next({
            code: 401,
            message: "Company no longer exists. Please contact administrator.",
          });
        }
        if (companyStatus.status !== "active") {
          return next({
            code: 403,
            message: "Your company account is deactivated. Contact system administrator.",
          });
        }
      }

      // session revocation - password/email reset, delete wa block pachi purano token dead
      // (TTL-cached, write path le invalidate garxa - platform-admin env account lai pardaina)
      if (sub !== "platform-admin" && mongoose.isObjectIdOrHexString(sub)) {
        const sessionDb = companyDb || CENTRAL_DB_NAME;
        const SessionUserModel =
          companyDb && companyDb !== CENTRAL_DB_NAME
            ? getTenantModel(companyDb, "User")
            : UserModel;
        const session = await getCachedUserSession(sub, sessionDb, () =>
          SessionUserModel.findById(sub).select("status tokenVersion").lean(),
        );
        if (!session.exists) {
          return next({
            code: 401,
            message: "Session expired. Please login again.",
          });
        }
        if (session.status !== "active") {
          return next({
            code: 403,
            message: "Your account is inactive",
          });
        }
        if (session.tokenVersion !== (tv ?? 0)) {
          return next({
            code: 401,
            message: "Session expired. Please login again.",
          });
        }
      }

      // req.user ko satta req.loggedInUser ma save garxa (reference pattern)
      req.loggedInUser = {
        _id: sub,
        role,
        email,
        mustChangePassword: mustChangePassword || false,
        companyDb,
        company: company ?? null,
      };

      return next();
    } catch (exception) {
      return next({ code: 401, message: "Invalid or expired token" });
    }
  };
};

export default checkLogin;
