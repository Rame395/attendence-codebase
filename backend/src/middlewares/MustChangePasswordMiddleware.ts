import type { Response, NextFunction } from "express";
import { getVerifiedAuth } from "../utils/requestAuth.js";

// temporary password login lai password change nagari dashboard/API access dinna (tenantContext cached verify reuse)
const requirePasswordChanged = () => {
  return (req: any, res: Response, next: NextFunction) => {
    // token naikholi bekar - checkLogin ma pachi handle huncha (401)
    const { token, decoded } = getVerifiedAuth(req);
    if (!token) {
      return next();
    }

    // invalid token haru checkLogin ma 401 handle huncha
    if (!decoded) {
      return next();
    }

    if (decoded.mustChangePassword) {
      return res.status(403).json({
        data: null,
        message: "You must change your password before accessing this resource",
        meta: null,
      });
    }

    next();
  };
};

export default requirePasswordChanged;
