import type { Request, Response, NextFunction } from "express";
import DepartmentService from "../services/DepartmentService.js";

class DepartmentController {
    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const branch = (req.query.branch as string) || null;
            const data = await DepartmentService.getAllDepartments(branch);
            res.json({
                data,
                message: "Departments fetched successfully",
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
                    message: "Invalid department ID",
                };
            }

            const data = await DepartmentService.getDepartmentById(id);
            if (!data) {
                throw {
                    code: 404,
                    message: "Department not found",
                };
            }

            res.json({
                data,
                message: "Department fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await DepartmentService.createDepartment({
                ...req.body,
                createdBy: req.loggedInUser?._id ?? null,
            });

            res.status(201).json({
                data,
                message: "Department created successfully",
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
                    message: "Invalid department ID",
                };
            }

            const data = await DepartmentService.updateDepartment(id, {
                ...req.body,
                updatedBy: req.loggedInUser?._id ?? null,
            });

            if (!data) {
                throw {
                    code: 404,
                    message: "Department not found",
                };
            }

            res.json({
                data,
                message: "Department updated successfully",
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
                    message: "Invalid department ID",
                };
            }

            const data = await DepartmentService.deleteDepartment(id);
            if (!data) {
                throw {
                    code: 404,
                    message: "Department not found",
                };
            }

            res.json({
                data: null,
                message: "Department deleted successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

export default DepartmentController;
