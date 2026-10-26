import type { Request, Response, NextFunction } from "express";
import NotificationService from "../services/NotificationService.js";

// notification controller - logged in user ko notifications
class NotificationController {
    getMy = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            if (!userId) throw { code: 401, message: "User not authenticated" };

            const [data, unread] = await Promise.all([
                NotificationService.getMyNotifications(userId),
                NotificationService.getUnreadCount(userId),
            ]);

            res.json({
                data,
                unread,
                message: "Notifications fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    unreadCount = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            if (!userId) throw { code: 401, message: "User not authenticated" };

            const count = await NotificationService.getUnreadCount(userId);

            res.json({
                data: { count },
                message: "Unread count fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    markAsRead = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            if (Array.isArray(id)) throw { code: 400, message: "Invalid ID" };

            const userId = req.loggedInUser?._id;
            const notification = await NotificationService.markAsRead(id, userId as string);

            if (!notification) throw { code: 404, message: "Notification not found" };

            res.json({
                data: notification,
                message: "Notification marked as read",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            if (!userId) throw { code: 401, message: "User not authenticated" };

            await NotificationService.markAllAsRead(userId);

            res.json({
                data: null,
                message: "All notifications marked as read",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    clearAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            if (!userId) throw { code: 401, message: "User not authenticated" };

            await NotificationService.deleteAll(userId);

            res.json({
                data: null,
                message: "All notifications cleared",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            if (Array.isArray(id)) throw { code: 400, message: "Invalid ID" };

            const userId = req.loggedInUser?._id;
            const notification = await NotificationService.deleteNotification(id, userId as string);

            if (!notification) throw { code: 404, message: "Notification not found" };

            res.json({
                data: null,
                message: "Notification deleted",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

export default NotificationController;
