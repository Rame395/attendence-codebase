import type { Request, Response, NextFunction } from "express";
import LeaveService from "../services/LeaveService.js";
import { saveUploadedFile } from "../utils/fileStorage.js";
import UserModel from "../model/UserModel.js";
import AuditLogService from "../services/AuditLogService.js";
import { getDirectReportIds, assertEmployeeInTeam } from "../utils/branchScope.js";

class LeaveController {
    createLeaveRequest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            const user = await UserModel.findById(userId);

            if (!user?.employee) {
                throw { code: 404, message: "Employee profile not found" };
            }

            const leaveRequest = await LeaveService.createLeaveRequest(req.body, user.employee.toString());

            res.status(201).json({
                data: leaveRequest,
                message: "Leave request created successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    getMyLeaveRequests = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            const user = await UserModel.findById(userId);

            if (!user?.employee) {
                throw { code: 404, message: "Employee profile not found" };
            }

            const requests = await LeaveService.getMyLeaveRequests(user.employee.toString());

            res.json({
                data: requests,
                message: "Leave requests fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    getAllLeaveRequests = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // manager le aafno direct reports ko leave requests matra dekhxa
            const teamIds = await getDirectReportIds(req.loggedInUser);
            const filter: any = {};
            if (teamIds && teamIds.length) {
                filter.employee = { $in: teamIds };
            }
            const requests = await LeaveService.getLeaveRequests(filter);

            res.json({
                data: requests,
                message: "Leave requests fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    approveLeaveRequest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid leave request ID" };
            }

            const { status } = req.body;
            const userId = req.loggedInUser?._id;

            if (!userId) {
                throw { code: 401, message: "User is not authenticated" };
            }

            // manager le aafno team ko leave matra approve/reject garna pauxa
            const requestRecord: any = await LeaveService.getLeaveRequestById(id);
            if (!requestRecord) {
                throw { code: 404, message: "Leave request not found" };
            }
            await assertEmployeeInTeam(requestRecord.employee, req.loggedInUser);

            const request = await LeaveService.approveLeaveRequest(id, status, userId);

            // audit log
            AuditLogService.logAction(
                userId.toString(),
                status === "approved" ? "Leave Approved" : "Leave Rejected",
                "leave",
                {
                    targetId: id,
                    employee: (request?.employee as any)?._id?.toString(),
                    newData: {
                        status,
                        leaveType: (request as any)?.leaveType,
                        startDate: (request as any)?.startDate,
                        endDate: (request as any)?.endDate,
                    },
                    ipAddress: req.ip,
                },
            );

            res.json({
                data: request,
                message: `Leave request ${status} successfully`,
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // attachment upload - pending owner ya admin le file attach garne
    uploadAttachment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid leave request ID" };
            }

            const file: any = req.file;

            if (!file) {
                throw { code: 422, message: "No file uploaded" };
            }

            const userId = req.loggedInUser?._id;
            const user = await UserModel.findById(userId);

            if (!user) {
                throw { code: 401, message: "Unauthorized" };
            }

            const leave: any = await LeaveService.getLeaveRequestById(id);

            if (!leave) {
                throw { code: 404, message: "Leave request not found" };
            }

            // owner bahek aru le upload garna payene (admin/HR bahek)
            const isOwner =
                user.employee &&
                (leave.employee as any)?._id?.toString() === user.employee.toString();
            const isAdmin = ["super_admin", "hr_admin"].includes(user.role);

            if (!isOwner && !isAdmin) {
                throw { code: 403, message: "You can only attach files to your own leave requests" };
            }

            if (leave.status !== "pending") {
                throw { code: 422, message: "Attachment can only be added to pending requests" };
            }

            const stored = await saveUploadedFile(file, "leaves");
            const updated = await LeaveService.updateLeaveRequest(id, {
                attachment: stored.url,
            });

            res.json({
                data: updated,
                message: "Attachment uploaded successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    deleteLeaveRequest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid leave request ID" };
            }

            await LeaveService.deleteLeaveRequest(id);

            res.json({
                data: null,
                message: "Leave request deleted successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

export default LeaveController;
