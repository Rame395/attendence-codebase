import type { Request, Response, NextFunction } from "express";
import DesignationService from "../services/DesignationService.js";
import AuditLogService from "../services/AuditLogService.js";

class DesignationController {
    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const department = (req.query.department as string) || null;
            const branch = (req.query.branch as string) || null;
            const data = await DesignationService.getAllDesignations(department, branch);
            res.json({
                data,
                message: "Designations fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    getSingle = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            if (Array.isArray(id)) {
                throw {
                    code: 400,
                    message: "Invalid designation ID",
                };
            }

            const data = await DesignationService.getDesignationById(id);
            if (!data) {
                throw {
                    code: 404,
                    message: "Designation not found",
                };
            }

            res.json({
                data,
                message: "Designation fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await DesignationService.createDesignation({
                ...req.body,
                createdBy: req.loggedInUser?._id ?? null,
            });

            await AuditLogService.logAction(
                req.loggedInUser?._id?.toString(),
                "Designation Created",
                "designation",
                {
                    targetId: (data as any)?._id?.toString(),
                    newData: {
                        name: (data as any)?.name,
                        description: (data as any)?.description,
                    },
                    ipAddress: req.ip,
                },
            );

            res.status(201).json({
                data,
                message: "Designation created successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            if (Array.isArray(id)) {
                throw {
                    code: 400,
                    message: "Invalid designation ID",
                };
            }

            const data = await DesignationService.updateDesignation(id, {
                ...req.body,
                updatedBy: req.loggedInUser?._id ?? null,
            });
            if (!data) {
                throw {
                    code: 404,
                    message: "Designation not found",
                };
            }

            await AuditLogService.logAction(
                req.loggedInUser?._id?.toString(),
                "Designation Updated",
                "designation",
                {
                    targetId: id,
                    newData: {
                        name: (data as any)?.name,
                        description: (data as any)?.description,
                        status: (data as any)?.status,
                    },
                    ipAddress: req.ip,
                },
            );

            res.json({
                data,
                message: "Designation updated successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            if (Array.isArray(id)) {
                throw {
                    code: 400,
                    message: "Invalid designation ID",
                };
            }

            const data = await DesignationService.deleteDesignation(id);
            if (!data) {
                throw {
                    code: 404,
                    message: "Designation not found",
                };
            }

            await AuditLogService.logAction(
                req.loggedInUser?._id?.toString(),
                "Designation Deleted",
                "designation",
                {
                    targetId: id,
                    oldData: {
                        name: (data as any)?.name,
                        description: (data as any)?.description,
                    },
                    ipAddress: req.ip,
                },
            );

            res.json({
                data: null,
                message: "Designation deleted successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

export default DesignationController;
