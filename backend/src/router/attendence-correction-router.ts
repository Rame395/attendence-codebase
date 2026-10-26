import { Router } from "express";
import AttendanceCorrectionController from "../controller/AttendenceCorrectionController.js";
import bodyValidator from "../middlewares/ValidationMiddleware.js";
import checkLogin from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";
import z from "zod";

// correction request ko DTO
export const CreateCorrectionDTO = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    requestedCheckIn: z.string().optional(),
    requestedCheckOut: z.string().optional(),
    reason: z.string().min(5),
});

export const ReviewCorrectionDTO = z.object({
    status: z.enum(["approved", "rejected"]),
    reviewReason: z.string().optional(),
});

const router = Router();
const controller = new AttendanceCorrectionController();

// employee le request create garne
router.post(
    "/",
    checkLogin(),
    allowRoles("employee", "manager", "hr_admin", "super_admin"),
    bodyValidator(CreateCorrectionDTO),
    controller.create,
);

// afno requests
router.get("/my", checkLogin(), controller.myRequests);

// admin/HR/manager le sabai requests herne
router.get("/", checkLogin(), allowRoles("super_admin", "hr_admin", "manager"), requirePermissions("corrections"), controller.list);

// approve/reject correction
router.put(
    "/:id/review",
    checkLogin(),
    allowRoles("super_admin", "hr_admin", "manager"),
    requirePermissions("corrections"),
    bodyValidator(ReviewCorrectionDTO),
    controller.review,
);

export default router;
