import { Router } from "express";
import NotificationController from "../controller/NotificationController.js";
import checkLogin from "../middlewares/AuthMiddleware.js";

const router = Router();
const controller = new NotificationController();

router.get("/", checkLogin(), controller.getMy);
router.get("/unread-count", checkLogin(), controller.unreadCount);
router.put("/read-all", checkLogin(), controller.markAllAsRead);
router.put("/:id/read", checkLogin(), controller.markAsRead);
router.delete("/all", checkLogin(), controller.clearAll);
router.delete("/:id", checkLogin(), controller.delete);

export default router;
