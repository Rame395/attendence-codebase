import { Router } from "express";
import BranchController from "../controller/BranchController.js";
import bodyValidator from "../middlewares/ValidationMiddleware.js";
import { CreateBranchDTO, UpdateBranchDTO } from "../request/BranchRequest.js";
import checkLogin
  from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";
const branchRouter = Router();
const ctrl = new BranchController();

branchRouter.get("/", checkLogin(), ctrl.getAll);
branchRouter.get("/:id", checkLogin(), ctrl.getSingle);
branchRouter.post(
    "/",
    checkLogin(),
    allowRoles("super_admin"),
    requirePermissions("branches"),
    bodyValidator(CreateBranchDTO),
    ctrl.create,
);
branchRouter.put(
    "/:id",
    checkLogin(),
    allowRoles("super_admin"),
    requirePermissions("branches"),
    bodyValidator(UpdateBranchDTO),
    ctrl.update,
);
branchRouter.delete("/:id", checkLogin(), allowRoles("super_admin"), requirePermissions("branches"), ctrl.delete);

export default branchRouter;
