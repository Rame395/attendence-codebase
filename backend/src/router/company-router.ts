import { Router } from "express";

import CompanyController from "../controller/CompanyController.js";

import bodyValidator
  from "../middlewares/ValidationMiddleware.js";

import {
  CreateCompanyDTO,
  UpdateCompanyDTO,
  CreateCompanySuperAdminDTO,
  UpdateCompanySuperAdminDTO,
} from "../request/CompanyRequest.js";
import checkLogin
  from "../middlewares/AuthMiddleware.js";
import { requireOwner } from "../middlewares/PermissionMiddleware.js";
import uploader from "../middlewares/UploaderMiddleware.js";


const companyRouter = Router();

const companyCtrl = new CompanyController();


// companies - owner only

companyRouter.get(
  "/",
  checkLogin(),
  requireOwner(),
  companyCtrl.getAll,
);

companyRouter.post(
  "/",
  checkLogin(),
  requireOwner(),
  bodyValidator(CreateCompanyDTO),
  companyCtrl.create,
);

// platform dashboard stats - /:id routes bhanda mathi (conflict nahos)
companyRouter.get(
  "/stats/overview",
  checkLogin(),
  requireOwner(),
  companyCtrl.getStats,
);

// central login directory - status + rebuild (owner only, /:id bhanda mathi)
companyRouter.get(
  "/directory/status",
  checkLogin(),
  requireOwner(),
  companyCtrl.getDirectoryStatus,
);

companyRouter.post(
  "/directory/rebuild",
  checkLogin(),
  requireOwner(),
  companyCtrl.rebuildDirectory,
);

companyRouter.patch(
  "/:id",
  checkLogin(),
  requireOwner(),
  bodyValidator(UpdateCompanyDTO),
  companyCtrl.update,
);

companyRouter.delete(
  "/:id",
  checkLogin(),
  requireOwner(),
  companyCtrl.delete,
);


// company logo upload / delete - owner le matra
companyRouter.post(
  "/:id/logo",
  checkLogin(),
  requireOwner(),
  uploader("/companies").single("logo"),
  companyCtrl.uploadLogo,
);

companyRouter.delete(
  "/:id/logo",
  checkLogin(),
  requireOwner(),
  companyCtrl.deleteLogo,
);


// company superadmins

companyRouter.get(
  "/:id/superadmins",
  checkLogin(),
  requireOwner(),
  companyCtrl.getSuperAdmins,
);

companyRouter.post(
  "/:id/superadmins",
  checkLogin(),
  requireOwner(),
  bodyValidator(CreateCompanySuperAdminDTO),
  companyCtrl.createSuperAdmin,
);

companyRouter.patch(
  "/:id/superadmins/:userId",
  checkLogin(),
  requireOwner(),
  bodyValidator(UpdateCompanySuperAdminDTO),
  companyCtrl.updateSuperAdmin,
);

companyRouter.delete(
  "/:id/superadmins/:userId",
  checkLogin(),
  requireOwner(),
  companyCtrl.deleteSuperAdmin,
);


export default companyRouter;
