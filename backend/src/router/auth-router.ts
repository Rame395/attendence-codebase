import { Router } from "express";

import AuthController from "../controller/AuthController.js";

import bodyValidator
  from "../middlewares/ValidationMiddleware.js";

import {
  LoginDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
  UpdateOwnProfileDTO,
  ChangeFirstPasswordDTO,
} from "../request/AuthRequest.js";
import {
  CreateUserDTO,
} from "../request/UserRequest.js";
import checkLogin
  from "../middlewares/AuthMiddleware.js";
import { allowRoles } from "../middlewares/RoleMiddleware.js";
import { requirePermissions } from "../middlewares/PermissionMiddleware.js";
import uploader from "../middlewares/UploaderMiddleware.js";


const authRouter = Router();

const authCtrl = new AuthController();


// login

authRouter.post(
  "/login",
  bodyValidator(LoginDTO),
  authCtrl.loginUser,
);


// register

authRouter.post(
  "/register",
  checkLogin(),
  allowRoles("super_admin"),
  requirePermissions("users"),
  bodyValidator(CreateUserDTO),
  authCtrl.register,
);


// forgot password

authRouter.post(
  "/forgot-password",
  bodyValidator(ForgotPasswordDTO),
  authCtrl.forgotPassword,
);


// reset password

authRouter.post(
  "/reset-password",
  bodyValidator(ResetPasswordDTO),
  authCtrl.resetPassword,
);


// protected routes

authRouter.get(
  "/me",
  checkLogin(),
  authCtrl.getLoggedInUserProfile,
);

// afno profile edit - sabai role le (locked fields backend le reject garcha)
authRouter.patch(
  "/profile",
  checkLogin(),
  bodyValidator(UpdateOwnProfileDTO),
  authCtrl.updateOwnProfile,
);

// afno profile photo upload / delete - preview sahit (multipart, validator chaina)
authRouter.post(
  "/profile-image",
  checkLogin(),
  uploader("/profiles").single("profileImage"),
  authCtrl.uploadOwnProfileImage,
);

authRouter.delete(
  "/profile-image",
  checkLogin(),
  authCtrl.deleteOwnProfileImage,
);

authRouter.post(
  "/logout",
  checkLogin(),
  authCtrl.logout,
);

authRouter.post(
  "/change-password",
  checkLogin(),
  authCtrl.changePassword,
);

// temporary password bata login gareko lai first-time password change
authRouter.post(
  "/change-first-password",
  checkLogin(),
  bodyValidator(ChangeFirstPasswordDTO),
  authCtrl.changeFirstPassword,
);


export default authRouter;
