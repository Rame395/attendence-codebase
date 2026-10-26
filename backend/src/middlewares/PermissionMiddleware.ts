import type { Response, NextFunction } from "express";
import { CENTRAL_DB_NAME, getTenantModel } from "../config/tenant.js";
import { getCachedUserPerms } from "../utils/authCache.js";

// permission guard - company superadmin ticks matra enforce garxa (roles lai kei gardaina), TTL-cached

function isOwnerDb(companyDb?: string): boolean {
  return !companyDb || companyDb === CENTRAL_DB_NAME;
}

// system owner matra - platform_admin, wa central super_admin (purano backward compat)
export const requireOwner = () => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.loggedInUser) {
      return next({ code: 401, message: "Unauthorized" });
    }
    if (req.loggedInUser.role === "platform_admin") {
      return next();
    }
    if (
      req.loggedInUser.role !== "super_admin" ||
      !isOwnerDb(req.loggedInUser.companyDb)
    ) {
      return next({ code: 403, message: "Access denied" });
    }
    next();
  };
};

// company superadmin sanga sabai keys chan ki chhainan (cached DB read)
export const requirePermissions = (...keys: string[]) => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      if (!req.loggedInUser) {
        return next({ code: 401, message: "Unauthorized" });
      }
      // owner + non-super_admin roles lai role checks le handle garxa
      if (
        req.loggedInUser.role !== "super_admin" ||
        isOwnerDb(req.loggedInUser.companyDb)
      ) {
        return next();
      }
      const UserModel = getTenantModel(req.loggedInUser.companyDb, "User");
      const userId = req.loggedInUser._id;
      const companyDb = req.loggedInUser.companyDb;
      const doc = await getCachedUserPerms(companyDb, userId, () =>
        UserModel.findById(userId).select("permissions status").lean(),
      );
      if (!doc.exists || doc.status !== "active") {
        return next({ code: 403, message: "Access denied" });
      }
      const granted: string[] = doc.permissions || [];
      const allowed = keys.every((k) => granted.includes(k));
      if (!allowed) {
        return next({
          code: 403,
          message: "This function is not enabled for your account",
        });
      }
      next();
    } catch (exception) {
      next(exception);
    }
  };
};

// keys madhye kamtima euta bhaye pugne (read-only shared routes ko lagi)
export const requireAnyPermission = (...keys: string[]) => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      if (!req.loggedInUser) {
        return next({ code: 401, message: "Unauthorized" });
      }
      if (
        req.loggedInUser.role !== "super_admin" ||
        isOwnerDb(req.loggedInUser.companyDb)
      ) {
        return next();
      }
      const UserModel = getTenantModel(req.loggedInUser.companyDb, "User");
      const userId = req.loggedInUser._id;
      const companyDb = req.loggedInUser.companyDb;
      const doc = await getCachedUserPerms(companyDb, userId, () =>
        UserModel.findById(userId).select("permissions status").lean(),
      );
      if (!doc.exists || doc.status !== "active") {
        return next({ code: 403, message: "Access denied" });
      }
      const granted: string[] = doc.permissions || [];
      const allowed = keys.some((k) => granted.includes(k));
      if (!allowed) {
        return next({
          code: 403,
          message: "This function is not enabled for your account",
        });
      }
      next();
    } catch (exception) {
      next(exception);
    }
  };
};
