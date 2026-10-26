import { Router } from "express";

import checkLogin from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requireAnyPermission, requirePermissions } from "../middlewares/PermissionMiddleware.js";
import bodyValidator from "../middlewares/ValidationMiddleware.js";
import AttendanceController from "../controller/AttendanceController.js";
import { MarkAttendanceDTO, UpdateAttendanceDTO } from "../request/AttendanceRequest.js";

const router = Router();
const controller = new AttendanceController();

router.post(
    "/check-in",
    checkLogin(),
    allowRoles("employee", "manager", "hr_admin", "super_admin"),
    controller.checkIn,
);

router.post(
    "/check-out",
    checkLogin(),
    allowRoles("employee", "manager", "hr_admin", "super_admin"),
    controller.checkOut,
);

// admin/HR le manually attendance mark/edit garne (audit log sangai)
router.post(
    "/mark",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("attendance"),
    bodyValidator(MarkAttendanceDTO),
    controller.mark,
);

router.put(
    "/:id",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("attendance"),
    bodyValidator(UpdateAttendanceDTO),
    controller.update,
);

router.get("/my", checkLogin(), controller.myAttendance);
router.get("/today", checkLogin(), controller.todayStatus);
router.get("/calendar", checkLogin(), requirePermissions("calendar"), controller.myCalendar);
router.get("/rate", checkLogin(), controller.myRate);
router.get("/summary", checkLogin(), allowRoles("super_admin", "hr_admin", "manager"), requirePermissions("attendance"), controller.summary);
// list - dashboard tick le pani herna pauxa (dashboard table ko lagi)
router.get("/", checkLogin(), allowRoles("super_admin", "hr_admin", "manager"), requireAnyPermission("attendance", "dashboard"), controller.list);

export default router;