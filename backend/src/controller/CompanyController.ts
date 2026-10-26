import type {
  Request,
  Response,
  NextFunction,
} from "express";

import CompanyService from "../services/CompanyService.js";
import UserDirectoryService from "../services/UserDirectoryService.js";
import AuditLogService from "../services/AuditLogService.js";

// company + superadmin manage garne - system owner (main super_admin) matra
class CompanyController {

  // sabai companies list
  getAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const companies = await CompanyService.listCompanies();

      res.json({
        data: companies,
        message: "Companies fetched successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // naya company + usko database provision
  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.loggedInUser?._id;

      const { company, superAdmin, emailSent, temporaryPassword } = await CompanyService.createCompany(
        {
          name: req.body.name,
          code: req.body.code,
          status: req.body.status,
          superadmin: req.body.superadmin || null,
        },
        userId,
      );

      AuditLogService.logAction(
        userId?.toString(),
        "Company Created",
        "company",
        {
          targetId: (company as any)?._id?.toString(),
          newData: {
            name: (company as any)?.name,
            dbName: (company as any)?.dbName,
            superAdmin: (superAdmin as any)?.email || null,
          },
          ipAddress: req.ip,
        },
      );

      res.status(201).json({
        data: { company, superAdmin, emailSent, temporaryPassword },
        message: superAdmin
          ? (emailSent
            ? "Company and super admin created successfully. Login details sent to email."
            : "Company and super admin created successfully, but login email could not be delivered. Share the password manually.")
          : "Company created successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // company update (name/status matra - dbName/code change hudaina)
  update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid company ID" };
      }

      const userId = req.loggedInUser?._id;

      const company = await CompanyService.updateCompany(
        id,
        {
          name: req.body.name,
          status: req.body.status,
        },
        userId,
      );

      AuditLogService.logAction(
        userId?.toString(),
        "Company Updated",
        "company",
        {
          targetId: id,
          newData: { name: req.body.name, status: req.body.status },
          ipAddress: req.ip,
        },
      );

      res.json({
        data: company,
        message: "Company updated successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // company logo upload garne
  uploadLogo = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid company ID" };
      }

      const company = await CompanyService.uploadCompanyLogo(
        id,
        req.file as Express.Multer.File,
      );

      res.json({
        data: company,
        message: "Company logo uploaded successfully",
        meta: { storage: "local" },
      });
    } catch (exception) {
      next(exception);
    }
  };

  // company logo hataune
  deleteLogo = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid company ID" };
      }

      const company = await CompanyService.deleteCompanyLogo(id);

      res.json({
        data: company,
        message: "Company logo removed successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // platform dashboard stats (owner only)
  getStats = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const stats = await CompanyService.getPlatformStats();

      res.json({
        data: stats,
        message: "Platform stats fetched successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // central login directory status (owner only) - ?deep=1 le tenant user verify pani
  getDirectoryStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const deep = req.query.deep === "1" || req.query.deep === "true";
      const status = await UserDirectoryService.getStatus({ deep });

      res.json({
        data: status,
        message: "Directory status fetched successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // central login directory rebuild (owner only) - tenant scan + sync
  rebuildDirectory = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const report = await UserDirectoryService.rebuild();

      AuditLogService.logAction(
        req.loggedInUser?._id?.toString(),
        "Directory Rebuilt",
        "company",
        {
          newData: report,
          ipAddress: req.ip,
        },
      );

      res.json({
        data: report,
        message: "Directory rebuild completed",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // company delete garne (tenant data wipe sahit - central default banda)
  delete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid company ID" };
      }

      await CompanyService.deleteCompany(id);

      AuditLogService.logAction(
        req.loggedInUser?._id?.toString(),
        "Company Deleted",
        "company",
        {
          targetId: id,
          ipAddress: req.ip,
        },
      );

      res.json({
        data: null,
        message: "Company deleted successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // company ko superadmin haru list
  getSuperAdmins = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid company ID" };
      }

      const superAdmins = await CompanyService.listCompanySuperAdmins(id);

      res.json({
        data: superAdmins,
        message: "Company super admins fetched successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // company ko lagi superadmin banaune (sidebar ticks sahit)
  createSuperAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;

      if (Array.isArray(id)) {
        throw { code: 400, message: "Invalid company ID" };
      }

      const userId = req.loggedInUser?._id;

      const { user: superAdmin, emailSent, temporaryPassword } = await CompanyService.createCompanySuperAdmin(
        id,
        {
          name: req.body.name,
          email: req.body.email,
          permissions: req.body.permissions,
        },
        userId,
      );

      AuditLogService.logAction(
        userId?.toString(),
        "Super Admin Created",
        "company",
        {
          targetId: (superAdmin as any)?._id?.toString(),
          newData: { email: req.body.email, permissions: req.body.permissions },
          ipAddress: req.ip,
        },
      );

      res.status(201).json({
        data: { superAdmin, emailSent, temporaryPassword },
        message: emailSent
          ? "Super admin created successfully. Login details sent to email."
          : "Super admin created successfully, but login email could not be delivered. Share the password manually.",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // superadmin ko ticks/status update garne
  updateSuperAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id, userId } = req.params;

      if (Array.isArray(id) || Array.isArray(userId)) {
        throw { code: 400, message: "Invalid ID" };
      }

      const superAdmin = await CompanyService.updateCompanySuperAdmin(
        id,
        userId,
        {
          permissions: req.body.permissions,
          status: req.body.status,
        },
      );

      AuditLogService.logAction(
        req.loggedInUser?._id?.toString(),
        "Super Admin Updated",
        "company",
        {
          targetId: userId,
          newData: { permissions: req.body.permissions, status: req.body.status },
          ipAddress: req.ip,
        },
      );

      res.json({
        data: superAdmin,
        message: "Super admin updated successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // company superadmin hataune
  deleteSuperAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id, userId } = req.params;

      if (Array.isArray(id) || Array.isArray(userId)) {
        throw { code: 400, message: "Invalid ID" };
      }

      await CompanyService.deleteCompanySuperAdmin(id, userId);

      AuditLogService.logAction(
        req.loggedInUser?._id?.toString(),
        "Super Admin Deleted",
        "company",
        {
          targetId: userId,
          ipAddress: req.ip,
        },
      );

      res.json({
        data: null,
        message: "Super admin deleted successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };
}

export default CompanyController;
