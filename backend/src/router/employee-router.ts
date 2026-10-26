import { Router } from "express";
import EmployeeController from "../controller/EmployeeController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";
import bodyValidator from "../middlewares/ValidationMiddleware.js";
import uploader from "../middlewares/UploaderMiddleware.js";
import { CreateEmployeeDTO, UpdateEmployeeDTO } from "../request/EmployeeRequest.js";

const employeeRouter = Router();
const employeeCtrl = new EmployeeController();

// sabai employee routes ma auth lagxa
employeeRouter.use(AuthMiddleware());

// GET / - sabai employees list (super_admin, hr_admin, manager le herna pauxa)
employeeRouter.get(
  "/",
  allowRoles("super_admin", "hr_admin", "manager"),
  requirePermissions("employees"),
  employeeCtrl.getAll,
);

// GET /me - logged-in employee ko aafno profile (sabai role le garna pauxa)
employeeRouter.get(
  "/me",
  allowRoles("super_admin", "hr_admin", "manager", "employee"),
  employeeCtrl.getMyProfile,
);

// PUT /me - logged-in employee le aafno profile update garna pauxa
employeeRouter.put(
  "/me",
  allowRoles("super_admin", "hr_admin", "manager", "employee"),
  employeeCtrl.updateMyProfile,
);

// POST / - employee create (super_admin/hr_admin; branch-scoped le aafno branch matra, manager sakdaina)
employeeRouter.post(
  "/",
  allowRoles("super_admin", "hr_admin"),
  requirePermissions("employees"),
  bodyValidator(CreateEmployeeDTO),
  employeeCtrl.create,
);

// GET /:id - euta employee ko detail (super_admin, hr_admin, manager)
employeeRouter.get(
  "/:id",
  allowRoles("super_admin", "hr_admin", "manager"),
  requirePermissions("employees"),
  employeeCtrl.getSingle,
);

// PUT /:id - employee update (manager le branch/department/manager change sakdaina, controller strip garxa)
employeeRouter.put(
  "/:id",
  allowRoles("super_admin", "hr_admin", "manager"),
  requirePermissions("employees"),
  bodyValidator(UpdateEmployeeDTO),
  employeeCtrl.update,
);

// DELETE /:id - employee delete (super_admin, hr_admin le garna pauxa)
employeeRouter.delete(
  "/:id",
  allowRoles("super_admin", "hr_admin"),
  requirePermissions("employees"),
  employeeCtrl.delete,
);

// POST /:id/profile-image - employee photo upload (super_admin, hr_admin)
employeeRouter.post(
  "/:id/profile-image",
  allowRoles("super_admin", "hr_admin"),
  requirePermissions("employees"),
  uploader("/profiles").single("profileImage"),
  employeeCtrl.uploadEmployeeImage,
);

// DELETE /:id/profile-image - employee photo hataune
employeeRouter.delete(
  "/:id/profile-image",
  allowRoles("super_admin", "hr_admin"),
  requirePermissions("employees"),
  employeeCtrl.deleteEmployeeImage,
);

export default employeeRouter;