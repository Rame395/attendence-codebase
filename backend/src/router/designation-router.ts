import { Router } from "express";
import DesignationController from "../controller/DesignationController.js";
import bodyValidator from "../middlewares/ValidationMiddleware.js";
import {
    CreateDesignationDTO,
    UpdateDesignationDTO,
} from "../request/DesignationRequest.js";
import checkLogin from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";

const designationRouter = Router();
const ctrl = new DesignationController();

designationRouter.get("/", checkLogin(), ctrl.getAll);
designationRouter.get("/:id", checkLogin(), ctrl.getSingle);
designationRouter.post(
    "/",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("designations"),
    bodyValidator(CreateDesignationDTO),
    ctrl.create,
);
designationRouter.put(
    "/:id",
    checkLogin(),
    allowRoles("super_admin", "hr_admin"),
    requirePermissions("designations"),
    bodyValidator(UpdateDesignationDTO),
    ctrl.update,
);
designationRouter.delete("/:id", checkLogin(), allowRoles("super_admin"), requirePermissions("designations"), ctrl.delete);

export default designationRouter;