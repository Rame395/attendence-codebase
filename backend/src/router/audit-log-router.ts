import { Router } from "express";
import AuditLogController from "../controller/AuditLogController.js";
import checkLogin from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";

const router = Router();
const controller = new AuditLogController();

// audit logs super_admin/hr_admin matra herne
router.get("/", checkLogin(), allowRoles("super_admin", "hr_admin"), requirePermissions("audit-logs"), controller.list);

// euta log delete - database batai hataune
router.delete("/:id", checkLogin(), allowRoles("super_admin", "hr_admin"), requirePermissions("audit-logs"), controller.deleteOne);

// sabai audit history delete garne
router.delete("/", checkLogin(), allowRoles("super_admin", "hr_admin"), requirePermissions("audit-logs"), controller.clearAll);

export default router;
