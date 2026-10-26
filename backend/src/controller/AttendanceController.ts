import type { Request, Response, NextFunction } from "express";
import AttendanceService from "../services/AttendanceService.js";
import AuditLogService from "../services/AuditLogService.js";
import {
  getDirectReportIds,
  getRequesterBranchId,
} from "../utils/branchScope.js";

class AttendanceController {
    checkIn = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            const result = await AttendanceService.checkIn({
                userId,
                ...req.body,
            });

            res.status(201).json({
                data: result,
                message: "Check-in successful",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    checkOut = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            const result = await AttendanceService.checkOut(userId, req.body);

            res.json({
                data: result,
                message: "Check-out successful",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // aaja ko status - employee dashboard ko lagi
    todayStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            const data = await AttendanceService.getTodayStatus(userId);

            res.json({
                data,
                message: "Today's attendance status fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    myAttendance = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            const data = await AttendanceService.getMyAttendance(userId);

            res.json({
                data,
                message: "My attendance fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // monthly calendar - BS calendar view ko lagi
    myCalendar = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            const now = new Date();
            const year = Number(req.query.year) || now.getFullYear();
            const month = Number(req.query.month) || now.getMonth() + 1;

            const data = await AttendanceService.getMyMonthlyCalendar(userId, year, month);

            res.json({
                data,
                message: "Monthly calendar fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // monthly attendance rate
    myRate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.loggedInUser?._id;
            const now = new Date();
            const year = Number(req.query.year) || now.getFullYear();
            const month = Number(req.query.month) || now.getMonth() + 1;

            const data = await AttendanceService.getMyAttendanceRate(userId, year, month);

            res.json({
                data,
                message: "Attendance rate fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // manager le aafno direct reports ko attendance matra dekhxa
            const teamIds = await getDirectReportIds(req.loggedInUser);
            const scopeBranch = await getRequesterBranchId(req.loggedInUser);
            const data = await AttendanceService.getAttendanceList(
                {
                    ...req.query,
                    ...(scopeBranch ? { branchId: scopeBranch } : {}),
                },
                teamIds || undefined,
            );

            res.json({
                data,
                message: "Attendance list fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    summary = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teamIds = await getDirectReportIds(req.loggedInUser);
            const scopeBranch = await getRequesterBranchId(req.loggedInUser);
            const data = await AttendanceService.getAttendanceSummary({
                teamIds: teamIds || undefined,
                branchId: scopeBranch || undefined,
            });

            res.json({
                data,
                message: "Attendance summary fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // admin/HR le manually attendance mark garne
    mark = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const record = await AttendanceService.markAttendance(req.body);

            // audit log
            AuditLogService.logAction(
                req.loggedInUser?._id?.toString(),
                "Attendance Created",
                "attendance",
                {
                    targetId: (record?._id as any)?.toString(),
                    employee: req.body.employee,
                    newData: {
                        date: req.body.date,
                        status: record?.status,
                        checkInTime: req.body.checkInTime ?? null,
                        checkOutTime: req.body.checkOutTime ?? null,
                        workingMinutes: (record as any)?.workingMinutes,
                    },
                    ipAddress: req.ip,
                },
            );

            res.status(201).json({
                data: record,
                message: "Attendance marked successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // admin/HR le existing attendance edit garne
    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid attendance ID" };
            }

            const oldRecord: any = await AttendanceService.getAttendanceById(id);

            if (!oldRecord) {
                throw { code: 404, message: "Attendance record not found" };
            }

            const record = await AttendanceService.updateAttendance(id, req.body);

            // audit log
            AuditLogService.logAction(
                req.loggedInUser?._id?.toString(),
                "Attendance Modified",
                "attendance",
                {
                    targetId: id,
                    employee: (oldRecord?.employee as any)?._id?.toString(),
                    oldData: {
                        status: oldRecord.status,
                        checkInTime: oldRecord.checkIn?.time ?? null,
                        checkOutTime: oldRecord.checkOut?.time ?? null,
                        workingMinutes: oldRecord.workingMinutes,
                    },
                    newData: {
                        status: (record as any)?.status,
                        checkInTime: (record as any)?.checkIn?.time ?? null,
                        checkOutTime: (record as any)?.checkOut?.time ?? null,
                        workingMinutes: (record as any)?.workingMinutes,
                    },
                    ipAddress: req.ip,
                },
            );

            res.json({
                data: record,
                message: "Attendance updated successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

export default AttendanceController;
