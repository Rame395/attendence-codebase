import type {
  Request,
  Response,
  NextFunction,
} from "express";

import AuthService from "../services/AuthService.js";
import CompanyService from "../services/CompanyService.js";
import { runWithTenant } from "../config/tenant.js";
class AuthController {

  // login

  loginUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {

    try {

      const {
        email,
        password,
      } = req.body;

      const result =
        await AuthService.login(
          email,
          password,
        );

      res.json({
        data: result,
        message: "Login successful",
        meta: null,
      });

    } catch (exception) {

      console.log(exception);

      next(exception);
    }
  };


  // create user

  register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {

    try {

      const {
        name,
        email,
        username,
        phone,
        employeeId,
        role,
        department,
        designation,
        branch,
        departmentName,
        branchName,
      } = req.body;

      const createdBy =
        req.loggedInUser?._id;

      // kun company ma user banaune - aafnai default, arko company owner matra
      const { targetCompany, targetDb } =
        await CompanyService.resolveTargetTenant(req);

      const result =
        await runWithTenant(targetDb, () =>
          AuthService.createUser(
            {
              name,
              email,
              username,
              phone,
              employeeId,
              role,
              department,
              designation,
              branch,
              departmentName,
              branchName,
              companyId: targetCompany,
            },
            createdBy,
          ),
        );

      res.status(201).json({
        data: result,
        message:
          "User created successfully",
        meta: null,
      });

    } catch (exception) {

      console.log(exception);

      next(exception);
    }
  };


  // change first password

  changeFirstPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.loggedInUser?._id;

      if (!userId) {
        return res.status(401).json({
          data: null,
          message: "Unauthorized",
          meta: null,
        });
      }

      const { newPassword } = req.body;

      const result =
        await AuthService.changeFirstPassword(
          userId,
          newPassword,
        );

      res.json({
        data: result,
        message: "Password changed successfully. You can now access your dashboard.",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };


  // forgot password

  forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {

    try {

      const { email } = req.body;

      await AuthService.forgotPassword(
        email,
      );

      res.json({
        data: null,
        message:
          "Password reset code sent to your email",
        meta: null,
      });

    } catch (exception) {

      next(exception);
    }
  };


  // reset password

  resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {

    try {

      const {
        email,
        code,
        password,
      } = req.body;

      await AuthService.resetPassword(
        email,
        code,
        password,
      );

      res.json({
        data: null,
        message:
          "Password reset successful",
        meta: null,
      });

    } catch (exception) {

      next(exception);
    }
  };


  // get profile

  getLoggedInUserProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {

    try {

      const userId = req.loggedInUser?._id;

      if (!userId) {
        return res.status(401).json({
          data: null,
          message: "Unauthorized",
          meta: null,
        });
      }

      const profile =
        await AuthService.getProfile(userId);

      res.json({
        data: profile,
        message: "Profile fetched successfully",
        meta: null,
      });

    } catch (exception) {

      next(exception);
    }
  };


  // logout

  logout = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {

    try {

      res.json({
        data: null,
        message: "Logout successful",
        meta: null,
      });

    } catch (exception) {

      next(exception);
    }
  };


  // change password

  changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {

    try {

      const userId = req.loggedInUser?._id;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        return res.status(401).json({
          data: null,
          message: "Unauthorized",
          meta: null,
        });
      }

      const result = await AuthService.changePassword(
        userId,
        currentPassword,
        newPassword,
      );

      res.json({
        data: { accessToken: result.accessToken },
        message: "Password changed successfully. Other devices have been logged out.",
        meta: null,
      });

    } catch (exception) {

      next(exception);
    }
  };

  // afno profile update garne (name, email, phone, gender matra)
  updateOwnProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.loggedInUser?._id;

      if (!userId) {
        return res.status(401).json({
          data: null,
          message: "Unauthorized",
          meta: null,
        });
      }

      const { name, email, phone, gender, calendarPreference } = req.body;

      const updated =
        await AuthService.updateOwnProfile(
          userId,
          { name, email, phone, gender, calendarPreference },
        );

      res.json({
        data: updated,
        message: "Profile updated successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // afno profile photo upload garne - preview sahit
  uploadOwnProfileImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.loggedInUser?._id;

      if (!userId) {
        return res.status(401).json({
          data: null,
          message: "Unauthorized",
          meta: null,
        });
      }

      const updated = await AuthService.uploadOwnProfileImage(
        userId,
        req.file as Express.Multer.File,
      );

      res.json({
        data: updated,
        message: "Profile photo uploaded successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };

  // afno profile photo hataune
  deleteOwnProfileImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.loggedInUser?._id;

      if (!userId) {
        return res.status(401).json({
          data: null,
          message: "Unauthorized",
          meta: null,
        });
      }

      const updated = await AuthService.deleteOwnProfileImage(userId);

      res.json({
        data: updated,
        message: "Profile photo removed successfully",
        meta: null,
      });
    } catch (exception) {
      next(exception);
    }
  };
}

export default AuthController;
