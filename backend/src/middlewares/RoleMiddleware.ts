import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { UserRole } from "../types/index.js";


export const allowRoles =
  (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.loggedInUser) {
      return next({
        code: 401,
        message: "Unauthorized",
      });
    }

    // platform_admin le sabai role-gated routes access garna pauxa (system owner)
    if (req.loggedInUser.role === "platform_admin") {
      return next();
    }

    if (!roles.includes(req.loggedInUser.role)) {
      return next({
        code: 403,
        message: "Access denied",
      });
    }

    next();
  };