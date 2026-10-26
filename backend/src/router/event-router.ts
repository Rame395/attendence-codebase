import { Router } from "express";
import EventController from "../controller/EventController.js";
import bodyValidator from "../middlewares/ValidationMiddleware.js";
import { CreateEventDTO, UpdateEventDTO } from "../request/EventRequest.js";
import checkLogin from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";
import uploader from "../middlewares/UploaderMiddleware.js";

const router = Router();
const controller = new EventController();

router.get("/", checkLogin(), controller.getAll);
router.get("/upcoming", checkLogin(), controller.getUpcoming);
router.get("/:id", checkLogin(), controller.getById);

router.post(
    "/",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("events"),
    bodyValidator(CreateEventDTO),
    controller.create,
);

router.put(
    "/:id",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("events"),
    bodyValidator(UpdateEventDTO),
    controller.update,
);

router.delete("/:id", checkLogin(), allowRoles("super_admin", "hr_admin"), requirePermissions("events"), controller.delete);

// attachment upload - admin/HR le matra
router.post(
    "/:id/attachment",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("events"),
    uploader("/events").single("attachment"),
    controller.uploadAttachment,
);

export default router;