import AttendanceCorrectionModel from "../model/AttendanceCorrectionModel.js";
import AttendanceModel from "../model/AttendanceModel.js";
import UserModel from "../model/UserModel.js";
import EmployeeModel from "../model/EmployeeModel.js";
import CompanySettingModel from "../model/CompanySettingModel.js";
import AuditLogService from "./AuditLogService.js";
import NotificationService from "./NotificationService.js";
import { assertEmployeeInTeam } from "../utils/branchScope.js";
import { tzDayRange, parseTimeOnDate } from "../utils/timezone.js";

// attendance correction service
class AttendanceCorrectionService {
    // naya correction request create garne
    static async createRequest(data: {
        userId?: string;
        date: string;
        requestedCheckIn?: string;
        requestedCheckOut?: string;
        reason: string;
    }) {
        const user = await UserModel.findById(data.userId).populate("employee");
        if (!user || !user.employee) {
            throw { code: 404, message: "Employee profile not found" };
        }

        // tyo date ko attendance record khojne
        const { start: dayStart, end: dayEnd } = tzDayRange(data.date);

        const attendance = await AttendanceModel.findOne({
            employee: user.employee,
            date: { $gte: dayStart, $lte: dayEnd },
        });

        // duplicate pending request check
        const pending = await AttendanceCorrectionModel.findOne({
            employee: user.employee,
            date: { $gte: dayStart, $lte: dayEnd },
            status: "pending",
        });
        if (pending) {
            throw { code: 409, message: "A correction request for this date is already pending" };
        }

        const created = await AttendanceCorrectionModel.create({
            employee: user.employee,
            attendance: attendance?._id ?? null,
            date: dayStart,
            requestedCheckIn: parseTimeOnDate(data.date, data.requestedCheckIn),
            requestedCheckOut: parseTimeOnDate(data.date, data.requestedCheckOut),
            reason: data.reason,
            createdBy: data.userId,
        });

        await AuditLogService.logAction(
            data.userId,
            "Correction Requested",
            "attendance",
            {
                targetId: created._id.toString(),
                employee: (user.employee as any)?._id?.toString?.() ?? user.employee.toString(),
                newData: {
                    date: data.date,
                    requestedCheckIn: data.requestedCheckIn ?? null,
                    requestedCheckOut: data.requestedCheckOut ?? null,
                    reason: data.reason,
                },
            },
        );

        // admins/HR/manager lai notify garne
        const empName = (user.employee as any)?.name || user.username || "An employee";
        const dateStr = new Date(data.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        NotificationService.notifyAdminsCorrectionRequest(
            (user.employee as any)?._id?.toString?.() ?? "",
            empName,
            dateStr,
            data.reason,
        );

        return created;
    }

    static async getMyRequests(userId: string | undefined) {
        const user = await UserModel.findById(userId).populate("employee");
        if (!user || !user.employee) {
            throw { code: 404, message: "Employee profile not found" };
        }

        return await AttendanceCorrectionModel
            .find({ employee: user.employee })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
    }

    static async getAllRequests(filters: { status?: string } = {}, teamEmployeeIds?: string[]) {
        const query: any = {};
        if (filters.status) query.status = filters.status;
        // manager ko lagi direct reports ko mata matra
        if (teamEmployeeIds && teamEmployeeIds.length) {
            query.employee = { $in: teamEmployeeIds };
        }

        return await AttendanceCorrectionModel
            .find(query)
            .populate("employee", "name employeeId email")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
    }

    // approve/reject - approve bhaye attendance record update + audit log
    static async reviewRequest(
        id: string,
        payload: { status: "approved" | "rejected"; reviewReason?: string },
        reviewerId: string | undefined,
        reviewer: any,
        ipAddress?: string,
    ) {
        const request: any = await AttendanceCorrectionModel.findById(id).populate("employee", "name employeeId branch");
        if (!request) {
            throw { code: 404, message: "Correction request not found" };
        }
        // manager le aafno team ko request matra review garna pauxa
        await assertEmployeeInTeam(request.employee, reviewer);
        if (request.status !== "pending") {
            throw { code: 409, message: "This request has already been reviewed" };
        }

        request.status = payload.status;
        request.reviewedBy = reviewerId as any;
        request.reviewedAt = new Date();
        request.reviewReason = payload.reviewReason ?? null;
        request.updatedBy = reviewerId as any;
        await request.save();

        if (payload.status === "approved") {
            // attendance record update garne
            const { start: dayStart, end: dayEnd } = tzDayRange(new Date(request.date));

            let attendance: any = await AttendanceModel.findOne({
                employee: request.employee._id,
                date: { $gte: dayStart, $lte: dayEnd },
            });

            const oldData = attendance ? JSON.parse(JSON.stringify(attendance.toJSON())) : null;

            if (!attendance) {
                // record nai chhaina bhane naya banaune (employee ko branch + settings use garera)
                const emp: any = await EmployeeModel.findById(request.employee._id).select("branch");
                if (!emp?.branch) {
                    throw { code: 422, message: "Employee has no branch assigned" };
                }
                attendance = new AttendanceModel({
                    employee: request.employee._id,
                    branch: emp.branch,
                    date: dayStart,
                    workingMinutes: 0,
                });
            }

            if (request.requestedCheckIn) {
                attendance.checkIn = {
                    ...(attendance.checkIn?.toObject?.() ?? attendance.checkIn ?? {}),
                    time: request.requestedCheckIn,
                };
            }
            if (request.requestedCheckOut) {
                attendance.checkOut = {
                    ...(attendance.checkOut?.toObject?.() ?? attendance.checkOut ?? {}),
                    time: request.requestedCheckOut,
                };
            }

            // working hours recalculate garne
            if (attendance.checkIn?.time && attendance.checkOut?.time) {
                const inTime = new Date(attendance.checkIn.time).getTime();
                const outTime = new Date(attendance.checkOut.time).getTime();
                attendance.workingMinutes = Math.max(0, Math.round((outTime - inTime) / 60000));

                const settings = await CompanySettingModel.findOne().lean();
                const minMinutes = settings?.minimumWorkingMinutes ?? 240;
                if (attendance.workingMinutes < minMinutes) {
                    attendance.status = "absent";
                } else if (["absent", "missing_checkin", "missing_checkout"].includes(attendance.status)) {
                    attendance.status = "present";
                }
            } else if (!attendance.checkIn?.time) {
                attendance.status = "missing_checkin";
            }

            await attendance.save();

            // audit log
            await AuditLogService.logAction(reviewerId, "Attendance Modified", "attendance", {
                targetId: attendance._id?.toString(),
                employee: request.employee._id?.toString(),
                oldData,
                newData: JSON.parse(JSON.stringify(attendance.toJSON())),
                reason: `Approved correction: ${request.reason}`,
                ipAddress,
            });
        } else {
            await AuditLogService.logAction(reviewerId, "Correction Rejected", "attendance", {
                targetId: request._id?.toString(),
                employee: request.employee._id?.toString(),
                reason: payload.reviewReason || request.reason,
                ipAddress,
            });
        }

        // notification pathaune
        await NotificationService.notifyCorrectionStatus(request.employee._id?.toString() ?? "", payload.status);

        return request;
    }
}

export default AttendanceCorrectionService;
