import type { Request, Response, NextFunction } from "express";
import EmployeeModel from "../model/EmployeeModel.js";
import UserModel from "../model/UserModel.js";
import AttendanceModel from "../model/AttendanceModel.js";
import LeaveRequestModel from "../model/LeaveRequestModel.js";
import { getDirectReportIds } from "../utils/branchScope.js";
import { countActualEmployees } from "../utils/employeeCount.js";
import { tzDayRange, formatCompanyDate, formatCompanyTime } from "../utils/timezone.js";

class ReportController {

    // attendance list ma employee ko login role attach garne (User.employee ref bata)
    static async attachRoles(attendanceList: any[]): Promise<any[]> {
        const employeeIds = attendanceList
            .map((r: any) => r.employee?._id)
            .filter(Boolean);
        if (!employeeIds.length) return attendanceList;

        const users = await UserModel.find(
            { employee: { $in: employeeIds }, status: "active" },
        )
            .select("employee role")
            .lean();

        const roleMap = new Map<string, string>();
        for (const u of users as any[]) {
            if (u.employee) roleMap.set(u.employee.toString(), u.role);
        }

        return attendanceList.map((r: any) => {
            if (!r.employee) return r;
            const role = roleMap.get(r.employee._id.toString()) || "employee";
            return { ...r, employee: { ...r.employee, role } };
        });
    }

    // dashboard - summary + today list (paginated)
    dashboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const q = req.query as Record<string, unknown>;
            const isTrue = (v: unknown) =>
                v === true || v === 1 || (typeof v === "string" && ["1", "true"].includes(v.toLowerCase()));
            const summaryOnly = isTrue(q.summaryOnly);
            const listOnly = isTrue(q.listOnly);

            const { start: startOfDay, end: endOfDay } = tzDayRange(new Date());

            // manager le aafno direct reports ko data matra dekhxa (team scoped)
            const teamIds = await getDirectReportIds(req.loggedInUser);
            const teamEmployeeFilter: Record<string, any> | null =
                teamIds && teamIds.length ? { employee: { $in: teamIds } } : null;
            const teamEmployeeExtra: Record<string, any> =
                teamIds && teamIds.length ? { _id: { $in: teamIds } } : {};

            // ---- list filter (AttendanceService.getAttendanceList sanga consistent) ----
            const branchId = String(q.branchId ?? "").trim();
            const departmentId = String(q.departmentId ?? "").trim();
            const designationId = String(q.designationId ?? "").trim();
            const employeeId = String(q.employeeId ?? "").trim();
            const status = String(q.status ?? "").trim();

            const buildListFilter = async (): Promise<Record<string, any>> => {
                const filter: Record<string, any> = {
                    date: { $gte: startOfDay, $lte: endOfDay },
                };
                if (branchId) filter.branch = branchId;
                if (status) filter.status = status;
                if (employeeId) {
                    // manager ko lagi: team bahira ko employee allowed chaina
                    if (teamIds && !teamIds.includes(employeeId)) {
                        filter.employee = { $in: [] };
                    } else {
                        filter.employee = employeeId;
                    }
                } else if (departmentId || designationId) {
                    const empQuery: Record<string, any> = {};
                    if (departmentId) empQuery.department = departmentId;
                    if (designationId) empQuery.designation = designationId;
                    let ids = await EmployeeModel.find(empQuery).distinct("_id");
                    if (teamIds) {
                        ids = ids.filter((id: any) => teamIds.includes(id.toString()));
                    }
                    // match nai nabhaye khali list (sabai lyaune hoina)
                    filter.employee = { $in: ids.length ? ids : ["000000000000000000000000"] };
                } else if (teamEmployeeFilter) {
                    filter.employee = teamEmployeeFilter.employee;
                }
                return filter;
            };

            const rawLimit = Number(q.limit);
            const rawSkip = Number(q.skip);
            const limit = Number.isFinite(rawLimit)
                ? Math.min(Math.max(Math.floor(rawLimit), 1), 100)
                : 10;
            const skip = Number.isFinite(rawSkip) ? Math.max(Math.floor(rawSkip), 0) : 0;

            // summaryOnly: counts + halka status rows (summary sadhai global today)
            if (summaryOnly && !listOnly) {
                const todayFilter = { date: { $gte: startOfDay, $lte: endOfDay }, ...teamEmployeeFilter };
                const [totalEmployees, statusRows, activeLeaves] = await Promise.all([
                    countActualEmployees(teamEmployeeExtra),
                    AttendanceModel.find(todayFilter).select("status checkIn checkOut").lean(),
                    LeaveRequestModel.countDocuments({
                        status: "approved",
                        startDate: { $lte: endOfDay },
                        endDate: { $gte: startOfDay },
                        ...teamEmployeeFilter,
                    }),
                ]);

                const presentToday = statusRows.filter((r: any) =>
                    ["present", "late", "half_day"].includes(r.status)
                ).length;

                const absentToday = statusRows.filter((r: any) =>
                    ["absent", "missing_checkin", "missing_checkout"].includes(r.status)
                ).length;

                const lateToday = statusRows.filter((r: any) => r.status === "late").length;

                const currentlyWorking = statusRows.filter((r: any) =>
                    r.checkIn && !r.checkOut
                ).length;

                return res.json({
                    data: {
                        summary: {
                            totalEmployees,
                            presentToday,
                            absentToday,
                            onLeave: activeLeaves,
                            lateToday,
                            currentlyWorking,
                        },
                    },
                    message: "Dashboard summary fetched successfully",
                    meta: null,
                });
            }

            // ---- list query (default + listOnly) - paginated + total ----
            const listFilter = await buildListFilter();

            // summary chahine bhaye (default) counts + global status rows sangai; summary sadhai unfiltered today
            if (!listOnly) {
                const todayFilter = { date: { $gte: startOfDay, $lte: endOfDay }, ...teamEmployeeFilter };
                const [totalEmployees, statusRows, activeLeaves, total, todayAttendance] = await Promise.all([
                    countActualEmployees(teamEmployeeExtra),
                    AttendanceModel.find(todayFilter).select("status checkIn checkOut").lean(),
                    LeaveRequestModel.countDocuments({
                        status: "approved",
                        startDate: { $lte: endOfDay },
                        endDate: { $gte: startOfDay },
                        ...teamEmployeeFilter,
                    }),
                    AttendanceModel.countDocuments(listFilter),
                    AttendanceModel.find(listFilter)
                        .populate({
                            path: "employee",
                            select: "name employeeId email department designation",
                            populate: [
                                { path: "department", select: "name code" },
                                { path: "designation", select: "name" },
                            ],
                        })
                        .populate("branch", "name code")
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                ]);

                const presentToday = statusRows.filter((r: any) =>
                    ["present", "late", "half_day"].includes(r.status)
                ).length;

                const absentToday = statusRows.filter((r: any) =>
                    ["absent", "missing_checkin", "missing_checkout"].includes(r.status)
                ).length;

                const lateToday = statusRows.filter((r: any) => r.status === "late").length;

                const currentlyWorking = statusRows.filter((r: any) =>
                    r.checkIn && !r.checkOut
                ).length;

                const summary = {
                    totalEmployees,
                    presentToday,
                    absentToday,
                    onLeave: activeLeaves,
                    lateToday,
                    currentlyWorking,
                };

                const attendanceList = await ReportController.attachRoles(
                    (todayAttendance as any[]).map((record: any) => ({
                        _id: record._id,
                        employee: record.employee,
                        branch: record.branch,
                        date: record.date,
                        checkIn: record.checkIn,
                        checkOut: record.checkOut,
                        status: record.status,
                        workingMinutes: record.workingMinutes,
                    })),
                );

                return res.json({
                    data: { summary, attendanceList },
                    message: "Dashboard summary fetched successfully",
                    meta: {
                        pagination: {
                            limit,
                            skip,
                            total,
                            page: Math.floor(skip / limit) + 1,
                            totalPage: Math.max(Math.ceil(total / limit), 1),
                        },
                    },
                });
            }

            // ---- listOnly: counts skip, list matra ----
            const [total, todayAttendance] = await Promise.all([
                AttendanceModel.countDocuments(listFilter),
                AttendanceModel.find(listFilter)
                    .populate({
                        path: "employee",
                        select: "name employeeId email department designation",
                        populate: [
                            { path: "department", select: "name code" },
                            { path: "designation", select: "name" },
                        ],
                    })
                    .populate("branch", "name code")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
            ]);

            const attendanceList = await ReportController.attachRoles(
                (todayAttendance as any[]).map((record: any) => ({
                    _id: record._id,
                    employee: record.employee,
                    branch: record.branch,
                    date: record.date,
                    checkIn: record.checkIn,
                    checkOut: record.checkOut,
                    status: record.status,
                    workingMinutes: record.workingMinutes,
                })),
            );

            return res.json({
                data: { attendanceList },
                message: "Dashboard attendance list fetched successfully",
                meta: {
                    pagination: {
                        limit,
                        skip,
                        total,
                        page: Math.floor(skip / limit) + 1,
                        totalPage: Math.max(Math.ceil(total / limit), 1),
                    },
                },
            });
        } catch (error) {
            next(error);
        }
    };

    // attendance report - date range bata attendance data dinxa
    attendanceReport = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { startDate, endDate, departmentId, branchId, designationId, status } = req.query;

            const filter: Record<string, any> = {};

            if (startDate || endDate) {
                const effectiveStart = String(startDate || endDate);
                const effectiveEnd = String(endDate || startDate);
                const { start } = tzDayRange(effectiveStart);
                const { end } = tzDayRange(effectiveEnd);
                filter.date = { $gte: start, $lte: end };
            }

            if (branchId) filter.branch = branchId;
            if (status) filter.status = status;

            let attendance = await AttendanceModel.find(filter)
                .populate({
                    path: "employee",
                    select: "employeeId name email phone department branch designation isDeleted",
                    populate: [
                        { path: "department", select: "name code" },
                        { path: "branch", select: "name code" },
                        { path: "designation", select: "name" },
                    ],
                })
                .populate("branch", "name code")
                .sort({ date: -1 })
                .lean();

            if (departmentId) {
                attendance = attendance.filter((a: any) =>
                    a.employee?.department?._id?.toString() === departmentId
                );
            }
            if (designationId) {
                attendance = attendance.filter((a: any) =>
                    a.employee?.designation?._id?.toString() === designationId
                );
            }

            const reportData = attendance.map((a: any) => ({
                employeeId: a.employee?.employeeId || "",
                employeeName: a.employee?.name || "",
                // removed (soft deleted) employee - report ma highlight garna
                employeeStatus: !a.employee || a.employee.isDeleted ? "Removed" : "Active",
                email: a.employee?.email || "",
                phone: a.employee?.phone || "",
                department: a.employee?.department?.name || "",
                designation: a.employee?.designation?.name || "",
                branch: a.employee?.branch?.name || "",
                date: a.date ? formatCompanyDate(a.date) : "",
                checkIn: a.checkIn?.time ? formatCompanyTime(a.checkIn.time) : "",
                checkOut: a.checkOut?.time ? formatCompanyTime(a.checkOut.time) : "",
                status: a.status,
                workingMinutes: a.workingMinutes || 0,
            }));

            res.json({
                data: reportData,
                message: "Attendance report fetched successfully",
                meta: { total: reportData.length },
            });
        } catch (error) {
            next(error);
        }
    };

    // employee report - sabai employees ko data dinxa
    employeeReport = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { departmentId, branchId, designationId, status } = req.query;

            const filter: Record<string, any> = {};
            if (status) filter.status = status;
            if (departmentId) filter.department = departmentId;
            if (branchId) filter.branch = branchId;
            if (designationId) filter.designation = designationId;

            const employees = await EmployeeModel.find(filter)
                .populate("department", "name code")
                .populate("designation", "name")
                .populate("branch", "name code")
                .sort({ name: 1 })
                .lean();

            const reportData = employees.map((e: any) => ({
                employeeId: e.employeeId,
                name: e.name,
                email: e.email,
                phone: e.phone,
                department: e.department?.name || "",
                designation: e.designation?.name || "",
                branch: e.branch?.name || "",
                joiningDate: e.joiningDate ? formatCompanyDate(e.joiningDate) : "",
                // removed (soft deleted) employee - report ma highlight garna
                status: e.isDeleted ? "Removed" : e.status,
            }));

            res.json({
                data: reportData,
                message: "Employee report fetched successfully",
                meta: { total: reportData.length },
            });
        } catch (error) {
            next(error);
        }
    };

    // leave report - leave requests ko data dinxa
    leaveReport = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { startDate, endDate, status, departmentId, branchId, designationId } = req.query;

            const filter: Record<string, any> = {};

            if (status) filter.status = status;

            if (startDate || endDate) {
                const effectiveStart = String(startDate || endDate);
                const effectiveEnd = String(endDate || startDate);
                const { start } = tzDayRange(effectiveStart);
                const { end } = tzDayRange(effectiveEnd);
                filter.startDate = { $lte: end };
                filter.endDate = { $gte: start };
            }

            let leaves = await LeaveRequestModel.find(filter)
                .populate({
                    path: "employee",
                    select: "employeeId name email department branch designation isDeleted",
                    populate: [
                        { path: "department", select: "name" },
                        { path: "branch", select: "name" },
                        { path: "designation", select: "name" },
                    ],
                })
                .sort({ createdAt: -1 })
                .lean();

            if (departmentId) {
                leaves = leaves.filter((l: any) =>
                    l.employee?.department?._id?.toString() === departmentId
                );
            }
            if (branchId) {
                leaves = leaves.filter((l: any) =>
                    l.employee?.branch?._id?.toString() === branchId
                );
            }
            if (designationId) {
                leaves = leaves.filter((l: any) =>
                    l.employee?.designation?._id?.toString() === designationId
                );
            }

            const reportData = leaves.map((l: any) => ({
                employeeId: l.employee?.employeeId || "",
                employeeName: l.employee?.name || "",
                // removed (soft deleted) employee - report ma highlight garna
                employeeStatus: !l.employee || l.employee.isDeleted ? "Removed" : "Active",
                department: l.employee?.department?.name || "",
                designation: l.employee?.designation?.name || "",
                branch: l.employee?.branch?.name || "",
                leaveType: l.leaveType || "",
                startDate: l.startDate ? formatCompanyDate(l.startDate) : "",
                endDate: l.endDate ? formatCompanyDate(l.endDate) : "",
                reason: l.reason || "",
                status: l.status,
            }));

            res.json({
                data: reportData,
                message: "Leave report fetched successfully",
                meta: { total: reportData.length },
            });
        } catch (error) {
            next(error);
        }
    };

}

export default ReportController;
