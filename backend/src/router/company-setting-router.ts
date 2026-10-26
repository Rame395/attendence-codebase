import { Router } from "express";

import CompanySettingController from "../controller/CompanySettingController.js";
import checkLogin from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";

// yo router le company settings ko CRUD operations handle garxa
const companySettingRouter = Router();

const settingCtrl = new CompanySettingController();

// GET / - settings haru fetch garxa (public - login page le company name herna lai)
companySettingRouter.get(
  "/",
  settingCtrl.getSettings,
);

// PUT / - settings update garxa (super_admin matra garna pauxa)
companySettingRouter.put(
  "/",
  checkLogin(),
  allowRoles("super_admin"),
  requirePermissions("settings"),
  settingCtrl.updateSettings,
);

// POST / - settings save garxa (super_admin matra) - frontend bata POST use huncha
companySettingRouter.post(
  "/",
  checkLogin(),
  allowRoles("super_admin"),
  requirePermissions("settings"),
  settingCtrl.updateSettings,
);

export default companySettingRouter;
