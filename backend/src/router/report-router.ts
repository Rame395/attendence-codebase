import { Router } from "express";
import ReportController from "../controller/ReportController.js";
import checkLogin from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";

const reportRouter = Router();
const controller = new ReportController();

// dashboard summary - sabai role le herna pauxa
reportRouter.get(
    "/dashboard",
    checkLogin(),
    allowRoles("super_admin", "hr_admin", "manager", "employee"),
    requirePermissions("dashboard"),
    controller.dashboard,
);

// attendance report
reportRouter.get(
    "/attendance",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("reports"),
    controller.attendanceReport,
);

// employee report
reportRouter.get(
    "/employees",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("reports"),
    controller.employeeReport,
);

// leave report
reportRouter.get(
    "/leaves",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("reports"),
    controller.leaveReport,
);

export default reportRouter;
