import { Router } from "express";
import LeaveController from "../controller/LeaveController.js";
import bodyValidator from "../middlewares/ValidationMiddleware.js";
import { CreateLeaveRequestDTO, ApproveLeaveRequestDTO } from "../request/LeaveRequest.js";
import checkLogin from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";
import uploader from "../middlewares/UploaderMiddleware.js";

const router = Router();
const controller = new LeaveController();

// leave request sabai role le garna ho sakne (employee/manager/HR)
router.post(
    "/",
    checkLogin(),
    allowRoles("employee", "manager", "hr_admin", "super_admin"),
    bodyValidator(CreateLeaveRequestDTO),
    controller.createLeaveRequest,
);

router.get("/my", checkLogin(), controller.getMyLeaveRequests);

// list herne - manager/HR/super_admin (PDF: manager le approve garne)
router.get("/", checkLogin(), allowRoles("super_admin", "hr_admin", "manager"), requirePermissions("leave"), controller.getAllLeaveRequests);

// approve/reject leave
router.put(
    "/:id/approve",
    checkLogin(),
    allowRoles("super_admin", "hr_admin", "manager"),
    requirePermissions("leave"),
    bodyValidator(ApproveLeaveRequestDTO),
    controller.approveLeaveRequest,
);

router.delete("/:id", checkLogin(), allowRoles("super_admin", "hr_admin", "employee"), requirePermissions("leave"), controller.deleteLeaveRequest);

// attachment upload - pending request ko owner le (admin/HR le pani garna milne)
router.post(
    "/:id/attachment",
    checkLogin(),
    requirePermissions("leave"),
    uploader("/leaves").single("attachment"),
    controller.uploadAttachment,
);

export default router;
