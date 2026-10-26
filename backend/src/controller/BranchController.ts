import type { Request, Response, NextFunction } from "express";
import BranchService from "../services/BranchService.js";

class BranchController {
    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await BranchService.getAllBranches();
            res.json({
                data,
                message: "Branches fetched successfully",
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
                    message: "Invalid branch ID",
                };
            }

            const data = await BranchService.getBranchById(id);
            if (!data) {
                throw {
                    code: 404,
                    message: "Branch not found",
                };
            }

            res.json({
                data,
                message: "Branch fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await BranchService.createBranch({
                ...req.body,
                createdBy: req.loggedInUser?._id ?? null,
            });

            res.status(201).json({
                data,
                message: "Branch created successfully",
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
                    message: "Invalid branch ID",
                };
            }

            const data = await BranchService.updateBranch(id, {
                ...req.body,
                updatedBy: req.loggedInUser?._id ?? null,
            });
            if (!data) {
                throw {
                    code: 404,
                    message: "Branch not found",
                };
            }

            res.json({
                data,
                message: "Branch updated successfully",
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
                    message: "Invalid branch ID",
                };
            }

            const data = await BranchService.deleteBranch(id);
            if (!data) {
                throw {
                    code: 404,
                    message: "Branch not found",
                };
            }

            res.json({
                data: null,
                message: "Branch deleted successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

export default BranchController;
