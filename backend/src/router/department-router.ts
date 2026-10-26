import { Router } from "express";
import DepartmentController from "../controller/DepartmentController.js";
import bodyValidator from "../middlewares/ValidationMiddleware.js";
import {
    CreateDepartmentDTO,
    UpdateDepartmentDTO,
} from "../request/DepartmentRequest.js";
import checkLogin from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";

const departmentRouter = Router();
const ctrl = new DepartmentController();

departmentRouter.get("/", checkLogin(), ctrl.getAll);
departmentRouter.get("/:id", checkLogin(), ctrl.getSingle);
departmentRouter.post(
    "/",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("departments"),
    bodyValidator(CreateDepartmentDTO),
    ctrl.create,
);
departmentRouter.put(
    "/:id",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("departments"),
    bodyValidator(UpdateDepartmentDTO),
    ctrl.update,
);
departmentRouter.delete("/:id", checkLogin(), allowRoles("super_admin"), requirePermissions("departments"), ctrl.delete);

export default departmentRouter;
