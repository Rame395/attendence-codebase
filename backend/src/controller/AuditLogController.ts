import type { Request, Response, NextFunction } from "express";
import AuditLogService from "../services/AuditLogService.js";

// audit log controller
class AuditLogController {
    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const limit = Number(req.query.limit) || 100;
            const offset = Number(req.query.offset) || 0;

            const data = await AuditLogService.getAuditLogs(
                {
                    module: req.query.module as string,
                    action: req.query.action as string,
                    performedBy: req.query.performedBy as string,
                    employee: req.query.employee as string,
                },
                limit,
                offset,
            );

            res.json({
                data: data.data,
                message: "Audit logs fetched successfully",
                meta: { total: data.total, limit, offset },
            });
        } catch (error) {
            next(error);
        }
    };

    // euta audit log delete garne
    deleteOne = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid audit log ID" };
            }

            const deleted = await AuditLogService.deleteAuditLog(id);
            if (!deleted) {
                throw { code: 404, message: "Audit log not found" };
            }

            await AuditLogService.logAction(
                req.loggedInUser?._id?.toString(),
                "Audit Log Deleted",
                "audit",
                { targetId: id, ipAddress: req.ip },
            );

            res.json({
                data: null,
                message: "Audit log deleted successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // sabai audit history ekai saath delete garne
    clearAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await AuditLogService.clearAuditLogs();

            await AuditLogService.logAction(
                req.loggedInUser?._id?.toString(),
                "Audit History Cleared",
                "audit",
                { ipAddress: req.ip },
            );

            res.json({
                data: null,
                message: "Audit history cleared successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

export default AuditLogController;
