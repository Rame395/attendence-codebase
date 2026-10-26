import mongoose from "mongoose";
import AttendanceModel from "../model/AttendanceModel.js";
import EmployeeModel from "../model/EmployeeModel.js";
import UserModel from "../model/UserModel.js";
import BranchModel from "../model/BranchModel.js";
import CompanySettingModel from "../model/CompanySettingModel.js";
import HolidayModel from "../model/HolidayModel.js";
import LeaveRequestModel from "../model/LeaveRequestModel.js";
import { distanceInMeters } from "../utils/geofence.js";
import NotificationService from "./NotificationService.js";
import { COMPANY_TIMEZONE, timeZoneOffsetMinutes, wallClockParts, tzInstant } from "../utils/timezone.js";
import { countActualEmployees } from "../utils/employeeCount.js";

// GPS accuracy max limit (meter) - .env bata override garna milcha, default 300m (indoor/poor signal samet cover)
function getMaxGpsAccuracy(): number {
    const raw = Number(process.env.MAX_GPS_ACCURACY ?? 300);
    return Number.isFinite(raw) && raw > 0 ? raw : 300;
}

class AttendanceService {
    // helper: user bata employee profile nikalne
    static async getEmployeeByUserId(userId: string | undefined) {
        if (!userId) {
            throw { code: 401, message: "User is not authenticated" };
        }

        // platform admin ko employee profile hudaina (DB id hoina)
        if (!mongoose.isObjectIdOrHexString(userId)) {
            throw { code: 404, message: "Employee profile not found" };
        }

        const user = await UserModel.findById(userId).populate("employee");
        if (!user || !user.employee) {
            throw { code: 404, message: "Employee profile not found" };
        }

        const employee = await EmployeeModel.findById(user.employee);
        if (!employee) {
            throw { code: 404, message: "Employee not found" };
        }

        return { user, employee };
    }

    // helper: aaja ko date range (company timezone ma - container UTC bhaye pani server local time undaina)
    static async getTodayRange() {
        const now = new Date();
        const offset = timeZoneOffsetMinutes(COMPANY_TIMEZONE, now);
        const wall = wallClockParts(now, offset);
        return {
            today: now,
            start: tzInstant(offset, wall.year, wall.month, wall.day, 0),
            end: tzInstant(offset, wall.year, wall.month, wall.day, 1440),
            offset,
        };
    }

    // helper: GPS coordinates parse + accuracy check garne (common for both check-in & check-out)
    static parseGpsCoordinates(latitude: any, longitude: any, accuracy: any) {
        const limit = getMaxGpsAccuracy();
        const lat = Number(latitude);
        const lng = Number(longitude);
        // accuracy naauda (purano client) limit nai assume garne - pass hunchha
        const gpsAccuracy = accuracy === undefined || accuracy === null || accuracy === "" ? limit : Number(accuracy);

        if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(gpsAccuracy)) {
            throw { code: 422, message: "Invalid GPS coordinates" };
        }

        if (gpsAccuracy > limit) {
            throw {
                code: 422,
                message: `GPS accuracy is too poor (±${Math.round(gpsAccuracy)}m, limit ±${limit}m). Please go outside / near a window, turn on High-accuracy location, wait 10-20s and retry.`,
                details: {
                    accuracy: Math.round(gpsAccuracy * 10) / 10,
                    limit,
                    hint: "Desktop Chrome WiFi/IP fix often gives 10km+ accuracy. Test on a real phone with GPS, or Chrome DevTools > Sensors > override location.",
                },
            };
        }

        return { lat, lng, gpsAccuracy };
    }

    // helper: branch fetch + location check garne
    static async resolveBranch(employee: any, branchId: any) {
        const branch = await BranchModel.findById(branchId || employee.branch || null);
        if (!branch) {
            throw { code: 404, message: "Assigned branch not found" };
        }
        if (!branch.latitude && !branch.longitude) {
            throw { code: 422, message: "Office location is not configured. Contact admin." };
        }
        return branch;
    }

    // helper: geofence validate garne - PDF rule: backend le independently calculate garxa (check-in ko lagi strict)
    static async validateGeofence(employee: any, branchId: any, latitude: any, longitude: any, accuracy: any) {
        const branch = await this.resolveBranch(employee, branchId);
        const { lat, lng, gpsAccuracy } = this.parseGpsCoordinates(latitude, longitude, accuracy);

        const employeePoint = { latitude: lat, longitude: lng };
        const officePoint = { latitude: Number(branch.latitude), longitude: Number(branch.longitude) };
        const distance = distanceInMeters(employeePoint, officePoint);
        const radius = Number(branch.geofenceRadius ?? 20);

        // GPS uncertainty lai account garne: even best-case ma (distance - accuracy) radius bhitra cha bhane accept
        // e.g. distance=300m, accuracy=150m → 300-150=150 <= radius → accept
        // e.g. distance=500m, accuracy=150m → 500-150=350 > radius → reject
        if (distance - gpsAccuracy > radius) {
            throw {
                code: 422,
                message: `You are approximately ${Math.round(distance)}m away from ${branch.name} (GPS accuracy: ±${Math.round(gpsAccuracy)}m). You must be within ${radius}m to mark attendance.`,
            };
        }

        return { branch, lat, lng, gpsAccuracy, distance, radius };
    }

    // helper: "HH:mm" string lai minutes (0..1439) ma parse garne
    static parseTimeToMinutes(time: string): number {
        const [hour, minute] = time.split(":").map(Number);
        return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
    }

    // company settings + late check (overnight shift handle, timezone-safe)
    static async evaluateCheckInStatus(checkInTime: Date) {
        const settings = await CompanySettingModel.findOne().lean();
        const startTime = settings?.workingStartTime || "10:00";
        const endTime = settings?.workingEndTime || "18:00";
        const graceMinutes = settings?.lateGracePeriodMinutes ?? 15;

        const startMinutes = this.parseTimeToMinutes(startTime);
        const overnight = this.parseTimeToMinutes(endTime) <= startMinutes;
        const offset = timeZoneOffsetMinutes(COMPANY_TIMEZONE, checkInTime);
        const wall = wallClockParts(checkInTime, offset);

        let shiftStart = tzInstant(offset, wall.year, wall.month, wall.day, startMinutes);
        if (overnight && checkInTime.getTime() < shiftStart.getTime()) {
            shiftStart = new Date(shiftStart.getTime() - 24 * 60 * 60 * 1000);
        }

        const graceEnd = shiftStart.getTime() + graceMinutes * 60000;
        return checkInTime.getTime() > graceEnd ? "late" : "present";
    }

    // office end time pachhi check-in block garna (overnight shift handle)
    static async validateCheckInWindow(checkInTime: Date) {
        const settings = await CompanySettingModel.findOne().lean();
        const startTime = settings?.workingStartTime || "10:00";
        const endTime = settings?.workingEndTime || "18:00";

        const startMinutes = this.parseTimeToMinutes(startTime);
        const endMinutes = this.parseTimeToMinutes(endTime);
        const overnight = endMinutes <= startMinutes;
        const offset = timeZoneOffsetMinutes(COMPANY_TIMEZONE, checkInTime);
        const wall = wallClockParts(checkInTime, offset);

        const shiftStart = tzInstant(offset, wall.year, wall.month, wall.day, startMinutes);
        let officeEnd = tzInstant(offset, wall.year, wall.month, wall.day, endMinutes);

        if (overnight && checkInTime.getTime() >= shiftStart.getTime()) {
            officeEnd = new Date(officeEnd.getTime() + 24 * 60 * 60 * 1000);
        }

        if (checkInTime.getTime() > officeEnd.getTime()) {
            throw {
                code: 422,
                message: `Office time is over (office closes at ${endTime}). Check-in is not allowed now. If you were present, request an attendance correction so HR can mark you present.`,
            };
        }
    }

    // office closed (weekly holiday / company holiday) ma check-in/check-out block garne.
    // holiday ko scope (branch/department/gender) pani respect garxa - matlab aru branch/dept/gender
    // ko holiday le yo employee lai block gardaina (calendar logic sanga consistent).
    static async assertOfficeOpen(time = new Date(), employee?: any) {
        const settings = await CompanySettingModel.findOne().lean();
        const weeklyHolidays: string[] = settings?.weeklyHolidays || ["saturday"];

        const offset = timeZoneOffsetMinutes(COMPANY_TIMEZONE, time);
        const wall = wallClockParts(time, offset);
        const dayStart = tzInstant(offset, wall.year, wall.month, wall.day, 0);
        const dayEnd = tzInstant(offset, wall.year, wall.month, wall.day, 1440);

        const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
            new Date(Date.UTC(wall.year, wall.month, wall.day)).getUTCDay()
        ];
        if (weeklyHolidays.includes(dayName)) {
            throw { code: 422, message: "Office is closed today (weekly holiday). Attendance cannot be marked." };
        }

        const holidays: any[] = await HolidayModel.find({
            startDate: { $lte: dayEnd },
            endDate: { $gte: dayStart },
        }).lean();

        // employee lai apply hune holiday matra (branch/dept/gender filter)
        const applicable = holidays.filter((h: any) => {
            if (h.gender && h.gender !== "both") {
                const empGender = employee?.gender || "other";
                if (h.gender !== empGender) return false;
            }
            if (h.appliesTo === "branch") {
                const empBranchId = String(employee?.branch ?? "");
                return (h.branches || []).some((b: any) => String(b._id ?? b) === empBranchId);
            }
            if (h.appliesTo === "department") {
                const empDeptId = String(employee?.department ?? "");
                return (h.departments || []).some((d: any) => String(d._id ?? d) === empDeptId);
            }
            return true;
        });

        if (applicable.length > 0) {
            const title = applicable[0].title;
            throw { code: 422, message: `Office is closed today (${title}). Attendance cannot be marked.` };
        }
    }

    // holiday scope filter - gender/branch/department anusar (calendar + check-in block duitai)
    static filterApplicableHolidays(holidays: any[], employeeFull: any) {
        return (holidays || []).filter((h: any) => {
            if (h.gender && h.gender !== "both") {
                const empGender = employeeFull?.gender || "other";
                if (h.gender !== empGender) return false;
            }
            if (h.appliesTo === "branch") {
                const empBranchId = String((employeeFull?.branch as any)?._id ?? employeeFull?.branch ?? "");
                return (h.branches || []).some((b: any) => String(b._id ?? b) === empBranchId);
            }
            if (h.appliesTo === "department") {
                const empDeptId = String((employeeFull?.department as any)?._id ?? employeeFull?.department ?? "");
                return (h.departments || []).some((d: any) => String(d._id ?? d) === empDeptId);
            }
            return true;
        });
    }

    // employee lai lagu hune company holiday nikalne
    static async getHolidayForEmployee(employeeId: any, start: Date, end: Date) {
        const employee = await EmployeeModel.findById(employeeId).lean();
        const holidays: any[] = await HolidayModel.find({
            startDate: { $lte: end },
            endDate: { $gte: start },
        }).lean();

        return holidays.find((h: any) => {
            if (h.gender && h.gender !== "both" && h.gender !== (employee?.gender || "other")) {
                return false;
            }
            if (h.appliesTo === "branch") {
                const branchId = String(employee?.branch ?? "");
                return (h.branches || []).some((b: any) => String(b._id ?? b) === branchId);
            }
            if (h.appliesTo === "department") {
                const departmentId = String(employee?.department ?? "");
                return (h.departments || []).some((d: any) => String(d._id ?? d) === departmentId);
            }
            return true;
        }) || null;
    }

    static async checkIn(payload: any) {
        const { userId, latitude, longitude, accuracy } = payload;

        const { employee } = await this.getEmployeeByUserId(userId);

        const { today, start, end } = await this.getTodayRange();

        // office holiday ma check-in block (gender/branch/department scope anusar -
        // nalaagne holiday bhaye block hudaina, e.g. female-only male lai)
        const dayHoliday: any = await this.getHolidayForEmployee(employee._id, start, end);
        if (dayHoliday) {
            throw {
                code: 422,
                message: `Today is ${dayHoliday.title}. Office is closed - check-in is not allowed.`,
            };
        }

        // office end time pachhi check-in block (geofence bhanda pahile check)
        const checkInTime = new Date(); // server time nai use garxa
        await this.assertOfficeOpen(checkInTime, employee);
        await this.validateCheckInWindow(checkInTime);

        // geofence validation - backend le nai decide garxa
        const geo = await this.validateGeofence(employee, employee.branch, latitude, longitude, accuracy);

        const existing = await AttendanceModel.findOne({
            employee: employee._id,
            date: { $gte: start, $lte: end },
        });

        if (existing && existing.checkIn?.time) {
            throw { code: 409, message: "You already checked in today" };
        }

        const status = await this.evaluateCheckInStatus(checkInTime);

        const record = await AttendanceModel.findOneAndUpdate(
            {
                employee: employee._id,
                date: { $gte: start, $lte: end },
            },
            {
                employee: employee._id,
                branch: geo.branch._id,
                date: new Date(start),
                checkIn: {
                    time: checkInTime,
                    latitude: geo.lat,
                    longitude: geo.lng,
                    accuracy: geo.gpsAccuracy,
                    distance: Math.round(geo.distance * 10) / 10,
                },
                status,
                workingMinutes: 0,
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            },
        );

        // check-in notification (late bhaye late notification)
        await NotificationService.notifyCheckIn(employee._id.toString(), status === "late");

        // super_admin/hr_admin + direct manager lai pani notify garne
        NotificationService.notifyAdminsCheckIn(employee._id.toString(), employee.name, checkInTime, geo.distance, status === "late");

        return record;
    }

    static async checkOut(userId: string | undefined, payload: any) {
        const { latitude, longitude, accuracy } = payload;

        const { employee } = await this.getEmployeeByUserId(userId);

        // office closed (holiday/weekend) ma checkout pani block
        await this.assertOfficeOpen(new Date(), employee);

        const { start, end } = await this.getTodayRange();

        const record = await AttendanceModel.findOne({
            employee: employee._id,
            date: { $gte: start, $lte: end },
        });

        if (!record || !record.checkIn?.time) {
            throw { code: 404, message: "No check-in record found for today" };
        }

        if (record.checkOut?.time) {
            throw { code: 409, message: "You already checked out today" };
        }

        // checkout pani check-in jastai strict geofence - check-in branch kai office vitra huna parcha
        const geo = await this.validateGeofence(employee, record.branch, latitude, longitude, accuracy);

        const checkOutTime = new Date(); // server time
        const checkInTime = new Date(record.checkIn.time);
        const workingMinutes = Math.max(0, Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000));

        // minimum working minutes pura nagare absent (half day chaina -
        // present huna lai minimum hours compulsory)
        const settings = await CompanySettingModel.findOne().lean();
        const minMinutes = settings?.minimumWorkingMinutes ?? 240;
        let status = record.status;
        if (workingMinutes < minMinutes) {
            status = "absent";
        }

        record.checkOut = {
            time: checkOutTime,
            latitude: geo.lat,
            longitude: geo.lng,
            accuracy: geo.gpsAccuracy,
            distance: Math.round(geo.distance * 10) / 10,
        };
        record.workingMinutes = workingMinutes;
        record.status = status as any;

        await record.save();

        // check-out notification
        await NotificationService.notifyCheckOut(employee._id.toString(), workingMinutes);

        // super_admin/hr_admin + direct manager lai pani notify garne
        NotificationService.notifyAdminsCheckOut(employee._id.toString(), employee.name, checkOutTime, workingMinutes);

        return record;
    }

    // aaja ko attendance status (check-in gare ki nai, checkout bhayo ki nai)
    static async getTodayStatus(userId: string | undefined) {
        const { employee } = await this.getEmployeeByUserId(userId);

        const { start, end } = await this.getTodayRange();

        const record = await AttendanceModel
            .findOne({ employee: employee._id, date: { $gte: start, $lte: end } })
            .populate("branch", "name latitude longitude geofenceRadius")
            .lean();

        return {
            today: record ?? null,
            checkedIn: !!(record?.checkIn?.time),
            checkedOut: !!(record?.checkOut?.time),
        };
    }

    static async getMyAttendance(userId: string | undefined) {
        const { employee } = await this.getEmployeeByUserId(userId);
        return await AttendanceModel.find({ employee: employee._id }).sort({ date: -1 }).limit(60).lean();
    }

    // monthly calendar data - attendance + holidays + events + leave sabai merge garera pathaune
    static async getMyMonthlyCalendar(userId: string | undefined, year: number, month: number) {
        const { employee } = await this.getEmployeeByUserId(userId);

        // month: 1-12 (JS Date month 0-11 ho so -1)
        const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const [records, holidays, leaves] = await Promise.all([
            AttendanceModel.find({
                employee: employee._id,
                date: { $gte: startDate, $lte: endDate },
            }).lean(),
            HolidayModel.find({
                startDate: { $lte: endDate },
                endDate: { $gte: startDate },
            }).lean(),
            LeaveRequestModel.find({
                employee: employee._id,
                status: "approved",
                startDate: { $lte: endDate },
                endDate: { $gte: startDate },
            }).lean(),
        ]);

        // branch/department/gender chahiyo - scope-specific holiday filter ko lagi
        const employeeFull = await EmployeeModel.findById(employee._id)
            .populate("branch")
            .populate("department")
            .lean();

        // employee join bhaye pachi ko din matra "absent" count huncha.
        // joiningDate nabhaye created date lai base manaune (naya user ma 7 absent auto na dekhau).
        const empStartRaw: any = (employeeFull as any)?.joiningDate || (employeeFull as any)?.createdAt;
        const empStart = empStartRaw ? new Date(empStartRaw) : null;
        if (empStart && !Number.isNaN(empStart.getTime())) empStart.setHours(0, 0, 0, 0);

        // employee lai apply hune holiday matra (branch/dept/gender filter)
        const applicableHolidays = AttendanceService.filterApplicableHolidays(holidays, employeeFull);

        // settings bata weekly holidays nikalne
        const settings = await CompanySettingModel.findOne().lean();
        const weeklyHolidays: string[] = settings?.weeklyHolidays || ["saturday"];

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const days: any[] = [];
        const totalDays = endDate.getDate();

        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(year, month - 1, d);
            const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

            // yo din ko range (multi-day holiday match garna)
            const dayStart = new Date(year, month - 1, d, 0, 0, 0, 0);
            const dayEnd = new Date(year, month - 1, d, 23, 59, 59, 999);

            const record = records.find((r: any) => {
                const rd = new Date(r.date);
                return rd.getFullYear() === year && rd.getMonth() === month - 1 && rd.getDate() === d;
            });

            const holiday = applicableHolidays.find((h: any) => {
                const hs = new Date(h.startDate);
                const he = new Date(h.endDate);
                return hs <= dayEnd && he >= dayStart;
            });

            const onLeave = leaves.some((l: any) => {
                const ls = new Date(l.startDate);
                const le = new Date(l.endDate);
                const day = new Date(year, month - 1, d);
                return day >= new Date(ls.getFullYear(), ls.getMonth(), ls.getDate()) &&
                    day <= new Date(le.getFullYear(), le.getMonth(), le.getDate());
            });

            const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getDay()];

            let status = "none";
            if (holiday) status = "holiday";
            else if (onLeave) status = "leave";
            else if (record) status = record.status;
            else if (weeklyHolidays.includes(dayName)) status = "weekend";
            else if (date < todayStart) {
                // join hune aghi ko din pani absent chaina - "none" (no data) hunxa
                status = empStart && date < empStart ? "none" : "absent";
            }

            // join aghiko din ma auto-baneko record (check-in/out bina ko absent/
            // leave) lai pani count nagarne - naya employee ko rate 0 bata start huncha.
            // Real activity (check-in/out bhayeko) bhaye dekhaune.
            const hasActivity = !!(record?.checkIn?.time || record?.checkOut?.time);
            if (empStart && date < empStart && !hasActivity) status = "none";

            days.push({
                date: dateKey,
                status,
                checkIn: record?.checkIn ?? null,
                checkOut: record?.checkOut ?? null,
                workingMinutes: record?.workingMinutes ?? 0,
                holidayTitle: holiday?.title ?? null,
            });
        }

        return { days };
    }

    // monthly attendance rate
    static async getMyAttendanceRate(userId: string | undefined, year: number, month: number) {
        const calendar = await this.getMyMonthlyCalendar(userId, year, month);

        const counts: Record<string, number> = {
            present: 0, absent: 0, late: 0, leave: 0, holiday: 0, weekend: 0, half_day: 0,
        };
        let workingDays = 0;

        for (const day of calendar.days) {
            if (day.status === "holiday" || day.status === "weekend") continue;
            // "none" = future / join-bhanda-aghiko / aaja unrecorded - count nagarne.
            // yasle naya user ma false absent dekhaudaina ra holiday/weeekend workdays ma chaina.
            if (day.status === "none") continue;
            workingDays++;
            if (counts[day.status] !== undefined) counts[day.status]++;
        }

        // present ma late pani count hunxa (attendance rate ko lagi)
        const presentDays = counts.present + counts.late + counts.half_day;
        const rate = workingDays > 0 ? Number(((presentDays / workingDays) * 100).toFixed(2)) : 0;

        return {
            year, month, workingDays, ...counts, presentDays, rate,
        };
    }

    static async getAttendanceList(filters: any = {}, teamEmployeeIds?: string[]) {
        const query: any = {};

        if (filters.date) {
            const d = new Date(filters.date);
            const start = new Date(d);
            start.setHours(0, 0, 0, 0);
            const end = new Date(d);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }
        if (filters.branchId) query.branch = filters.branchId;
        if (filters.status) query.status = filters.status;

        // employee/department/designation filter - attendance ma employee ref bata hereko
        if (filters.employeeId) {
            // manager ko lagi: team bahira ko employee filter allowed chaina
            if (teamEmployeeIds && !teamEmployeeIds.includes(String(filters.employeeId))) {
                return [];
            }
            query.employee = filters.employeeId;
        } else if (filters.departmentId || filters.designationId) {
            const empQuery: any = {};
            if (filters.departmentId) empQuery.department = filters.departmentId;
            if (filters.designationId) empQuery.designation = filters.designationId;
            let employeeIds = await EmployeeModel.find(empQuery).distinct("_id");
            // manager ko lagi team sanga intersect garne
            if (teamEmployeeIds && teamEmployeeIds.length) {
                employeeIds = employeeIds.filter((id: any) =>
                    teamEmployeeIds.includes(id.toString()),
                );
            }
            if (employeeIds.length === 0) {
                return [];
            }
            query.employee = { $in: employeeIds };
        } else if (teamEmployeeIds && teamEmployeeIds.length) {
            query.employee = { $in: teamEmployeeIds };
        }

        return await AttendanceModel
            .find(query)
            .populate({
                path: "employee",
                select: "name employeeId email department designation",
                populate: [
                    { path: "department", select: "name code" },
                    { path: "designation", select: "name" },
                ],
            })
            .populate("branch", "name code")
            .sort({ date: -1 })
            .limit(200)
            .lean();
    }

    static async getAttendanceSummary(scope: { teamIds?: string[]; branchId?: string | null } = {}) {
        const { start, end } = await this.getTodayRange();

        const employeeFilter: any = { status: "active" };
        const recordFilter: any = { date: { $gte: start, $lte: end } };
        const leaveFilter: any = {
            status: "approved",
            startDate: { $lte: end },
            endDate: { $gte: start },
        };

        // manager: direct reports team matra; hr_admin: aafno branch matra
        if (scope.teamIds && scope.teamIds.length) {
            employeeFilter._id = { $in: scope.teamIds };
            recordFilter.employee = { $in: scope.teamIds };
            leaveFilter.employee = { $in: scope.teamIds };
        } else if (scope.branchId) {
            employeeFilter.branch = scope.branchId;
            recordFilter.branch = scope.branchId;
            const branchEmpIds = await EmployeeModel.find({ branch: scope.branchId }).distinct("_id");
            leaveFilter.employee = { $in: branchEmpIds };
        }

        // total employees - system accounts (hr_admin/manager/super_admin) ko linked record hataune
        const employeeExtra = { ...employeeFilter };
        delete employeeExtra.status;
        const [totalEmployees, attendanceRecords, onLeaveCount] = await Promise.all([
            countActualEmployees(employeeExtra),
            AttendanceModel.find(recordFilter).lean(),
            LeaveRequestModel.countDocuments(leaveFilter),
        ]);

        const presentToday = attendanceRecords.filter((r: any) => ["present", "late", "half_day"].includes(r.status)).length;
        const lateToday = attendanceRecords.filter((r: any) => r.status === "late").length;
        const currentlyWorking = attendanceRecords.filter(
            (r: any) => r.checkIn?.time && !r.checkOut?.time && ["present", "late"].includes(r.status),
        ).length;

        return {
            totalEmployees,
            presentToday,
            absentToday: Math.max(0, totalEmployees - presentToday - onLeaveCount),
            onLeave: onLeaveCount,
            lateToday,
            currentlyWorking,
        };
    }

    // manually mark attendance
    static async markAttendance(data: any) {
        const { employee, date, status, checkInTime, checkOutTime, workingMinutes } = data;

        if (!employee || !date) {
            throw { code: 422, message: "Employee and date are required" };
        }

        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const emp: any = await EmployeeModel.findById(employee).select("branch");
        if (!emp) {
            throw { code: 404, message: "Employee not found" };
        }
        if (!emp.branch) {
            throw { code: 422, message: "Employee has no branch assigned" };
        }

        const checkIn = checkInTime ? new Date(checkInTime) : null;
        const checkOut = checkOutTime ? new Date(checkOutTime) : null;

        let minutes = Number(workingMinutes);
        if (Number.isNaN(minutes) && checkIn && checkOut) {
            minutes = Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000));
        }
        if (Number.isNaN(minutes)) minutes = 0;

        let finalStatus = status;
        if (!finalStatus) {
            if (checkIn && checkOut) finalStatus = "present";
            else if (checkIn) finalStatus = "missing_checkout";
            else finalStatus = "present";
        }

        return await AttendanceModel.findOneAndUpdate(
            { employee, date: { $gte: dayStart, $lte: dayEnd } },
            {
                employee,
                branch: emp.branch,
                date: dayStart,
                ...(checkIn ? { checkIn: { time: checkIn } } : {}),
                ...(checkOut ? { checkOut: { time: checkOut } } : {}),
                status: finalStatus,
                workingMinutes: minutes,
            },
            { new: true, upsert: true, setDefaultsOnInsert: true },
        );
    }

    // single attendance record get garne (edit ko lagi)
    static async getAttendanceById(id: string) {
        return await AttendanceModel.findById(id)
            .populate("employee", "name employeeId email")
            .populate("branch", "name code")
            .lean();
    }

    // update existing attendance
    static async updateAttendance(id: string, data: any) {
        const record: any = await AttendanceModel.findById(id);
        if (!record) {
            throw { code: 404, message: "Attendance record not found" };
        }

        if (data.status !== undefined && data.status !== "") record.status = data.status;

        if (data.checkInTime !== undefined) {
            record.checkIn = {
                ...(record.checkIn?._doc ?? record.checkIn ?? {}),
                time: data.checkInTime ? new Date(data.checkInTime) : null,
            };
        }

        if (data.checkOutTime !== undefined) {
            record.checkOut = {
                ...(record.checkOut?._doc ?? record.checkOut ?? {}),
                time: data.checkOutTime ? new Date(data.checkOutTime) : null,
            };
        }

        if (data.workingMinutes !== undefined) {
            record.workingMinutes = Number(data.workingMinutes) || 0;
        } else if (record.checkIn?.time && record.checkOut?.time) {
            const inTime = new Date(record.checkIn.time).getTime();
            const outTime = new Date(record.checkOut.time).getTime();
            record.workingMinutes = Math.max(0, Math.round((outTime - inTime) / 60000));
        }

        await record.save();
        return record;
    }
}

export default AttendanceService;
