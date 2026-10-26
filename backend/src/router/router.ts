import { Router } from "express";
import authrouter from "./auth-router.js";
import userRouter from "./user-router.js";
import employeeRouter from "./employee-router.js";
import departmentRouter from "./department-router.js";
import designationRouter from "./designation-router.js";
import branchRouter from "./branch-router.js";
import attendanceRouter from "./attendance-router.js";
import leaveRouter from "./leave-router.js";
import holidayRouter from "./holiday-router.js";
import eventRouter from "./event-router.js";
import correctionRouter from "./attendence-correction-router.js";
import notificationRouter from "./notification-router.js";
import auditLogRouter from "./audit-log-router.js";
import reportRouter from "./report-router.js";
import companySettingRouter from "./company-setting-router.js";
import companyRouter from "./company-router.js";
import requirePasswordChanged from "../middlewares/MustChangePasswordMiddleware.js";
import { tenantContext } from "../config/tenant.js";

const mainRouter = Router();

// tenant (company db) context - JWT companyDb claim bata, token navaye central default
mainRouter.use(tenantContext());

  mainRouter.get("/", (req, res) => {
    res.json({
      data: "Attendance API is running",
      message: "Success",
      meta: null,
    });
  });

  // Docker / load-balancer healthcheck (no auth, no tenant lookup)
  mainRouter.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

mainRouter.use("/auth", authrouter);

// password change nabhaye samma dashboard/resource API access block garxa
mainRouter.use(requirePasswordChanged());

mainRouter.use("/users", userRouter);
mainRouter.use("/employees", employeeRouter);
mainRouter.use("/departments", departmentRouter);
mainRouter.use("/designations", designationRouter);
mainRouter.use("/branches", branchRouter);
mainRouter.use("/attendance", attendanceRouter);
mainRouter.use("/leaves", leaveRouter);
mainRouter.use("/holidays", holidayRouter);
mainRouter.use("/events", eventRouter);
mainRouter.use("/corrections", correctionRouter);
mainRouter.use("/notifications", notificationRouter);
mainRouter.use("/audit-logs", auditLogRouter);
mainRouter.use("/reports", reportRouter);
mainRouter.use("/company-settings", companySettingRouter);
mainRouter.use("/companies", companyRouter);

export default mainRouter;