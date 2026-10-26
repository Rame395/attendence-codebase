import { Router } from "express";

import UserController
  from "../controller/UserController.js";

import bodyValidator
  from "../middlewares/ValidationMiddleware.js";

import {
  CreateUserDTO,
  UpdateUserDTO,
} from "../request/UserRequest.js";

import checkLogin
  from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";



const userRouter = Router();

const userCtrl =
  new UserController();

userRouter.get(
  "/",

  checkLogin(),

  allowRoles(
    "super_admin",
    "hr_admin",
  ),

  requirePermissions("users"),

  userCtrl.getUsers,
);


// POST / - user + employee create (super_admin/hr_admin; role hierarchy controller le enforce garxa)
userRouter.post(
  "/",

  checkLogin(),

  allowRoles("super_admin", "hr_admin"),

  requirePermissions("users"),

  bodyValidator(CreateUserDTO),

  userCtrl.createUser,
);

// PUT /:id - user update (role/status/email) - super_admin/hr_admin le
userRouter.put(
  "/:id",

  checkLogin(),

  allowRoles("super_admin", "hr_admin"),

  requirePermissions("users"),

  bodyValidator(UpdateUserDTO),

  userCtrl.updateUser,
);

// DELETE /:id - user lai delete garxa (super_admin/hr_admin le matra)
userRouter.delete(
  "/:id",

  checkLogin(),

  allowRoles("super_admin", "hr_admin"),

  requirePermissions("users"),

  userCtrl.deleteUser,
);


export default userRouter;
