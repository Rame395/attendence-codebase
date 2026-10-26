import Login from "../../pages/auth/Login";
import ForgotPassword from "../../pages/auth/ForgetPassword";
import ResetPassword
  from "../../pages/auth/ResetPassword";
import ChangePassword from "../../pages/auth/ChangePassword";


export const PublicRouter = [

  { path: "/", Component: Login },

  { path: "/login", Component: Login },

  { path: "/forgot-password", Component: ForgotPassword },

  { path: "/reset-password", Component: ResetPassword },

  { path: "/change-password", Component: ChangePassword },

];
