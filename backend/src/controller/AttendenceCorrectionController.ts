import type { Request, Response, NextFunction } from "express";
import AttendanceCorrectionService from "../services/AttendanceCorrectionService.js";
import { getDirectReportIds } from "../utils/branchScope.js";

// attendance correction controller - request create/list/review
class AttendanceCorrectionController {
    // employee le naya correction request pathaune
    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            const data = await AttendanceCorrectionService.createRequest({
                userId,
                ...req.body,
            });

            res.status(201).json({
                data,
                message: "Correction request submitted successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // afno requests haru herne
    myRequests = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            const data = await AttendanceCorrectionService.getMyRequests(userId);

            res.json({
                data,
                message: "My correction requests fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // admin/HR le sabai requests herne
    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // manager le aafno direct reports ko correction requests matra dekhxa
            const teamIds = await getDirectReportIds(req.loggedInUser);
            const data = await AttendanceCorrectionService.getAllRequests(
                req.query,
                teamIds || undefined,
            );

            res.json({
                data,
                message: "Correction requests fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // approve/reject garne
    review = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid request ID" };
            }

            const reviewerId = req.loggedInUser?._id;
            const ipAddress = req.ip;

            const data = await AttendanceCorrectionService.reviewRequest(
                id,
                req.body,
                reviewerId,
                req.loggedInUser, // manager team-scope check ko lagi
                ipAddress,
            );

            res.json({
                data,
                message: `Correction request ${req.body.status}`,
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

export default AttendanceCorrectionController;
