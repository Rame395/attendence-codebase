import { Router } from "express";
import HolidayController from "../controller/HolidayController.js";
import bodyValidator from "../middlewares/ValidationMiddleware.js";
import { CreateHolidayDTO, UpdateHolidayDTO } from "../request/HolidayRequest.js";
import checkLogin from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";

const router = Router();
const controller = new HolidayController();

router.get("/", checkLogin(), controller.getAll);
router.get("/upcoming", checkLogin(), controller.getUpcoming);
router.get("/:id", checkLogin(), controller.getById);

router.post(
    "/",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("holidays"),
    bodyValidator(CreateHolidayDTO),
    controller.create,
);

router.put(
    "/:id",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("holidays"),
    bodyValidator(UpdateHolidayDTO),
    controller.update,
);

router.delete("/:id", checkLogin(), allowRoles("super_admin", "hr_admin"), requirePermissions("holidays"), controller.delete);

export default router;