import type { Request, Response, NextFunction } from "express";
import DesignationService from "../services/DesignationService.js";

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
