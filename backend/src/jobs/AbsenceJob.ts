import EmployeeModel from "../model/EmployeeModel.js";
import AttendanceModel from "../model/AttendanceModel.js";
import HolidayModel from "../model/HolidayModel.js";
import LeaveRequestModel from "../model/LeaveRequestModel.js";
import CompanySettingModel from "../model/CompanySettingModel.js";
import CompanyModel from "../model/CompanyModel.js";
import NotificationService from "../services/NotificationService.js";
import { CENTRAL_DB_NAME, runWithTenant } from "../config/tenant.js";
import { COMPANY_TIMEZONE, timeZoneOffsetMinutes, wallClockParts, tzInstant } from "../utils/timezone.js";
import { nptHour, nptTodayKey } from "../utils/nepalTime.js";

// automatic absence job
class AbsenceJob {
    private static timer: NodeJS.Timeout | null = null;
    private static lastRunDate = "";

    // aaja ko absence mark - har active company ko aafnai db/settings/holiday anusar (multi-tenant)
    static async runForDate(date = new Date()) {
        const companies: any[] = await CompanyModel.find({ status: "active" })
            .select("dbName")
            .lean();
        const dbNames = [
            CENTRAL_DB_NAME,
            ...companies
                .map((c) => c.dbName)
                .filter((d) => d && d !== CENTRAL_DB_NAME),
        ];

        let absentCount = 0;
        let missingCheckoutCount = 0;
        const skipped: string[] = [];

        for (const dbName of dbNames) {
            const result: any = await runWithTenant(dbName, () =>
                this.runForTenant(date),
            );
            if (result?.skipped) skipped.push(`${dbName}:${result.skipped}`);
            else {
                absentCount += result?.absentCount || 0;
                missingCheckoutCount += result?.missingCheckoutCount || 0;
            }
        }

        return { companies: dbNames.length, absentCount, missingCheckoutCount, skipped };
    }

    private static async runForTenant(date: Date) {
        const offset = timeZoneOffsetMinutes(COMPANY_TIMEZONE, date);
        const wall = wallClockParts(date, offset);
        const dayStart = tzInstant(offset, wall.year, wall.month, wall.day, 0);
        const dayEnd = tzInstant(offset, wall.year, wall.month, wall.day, 1440);

        // aaja bhanda pahile ko date lai matra process garne (aaja ali pachadi run huda) -
        // aaja ko din "none" rahancha (kahilyai auto-absent hudaina), bholi matra absent banchha.
        // Naya join bhayeko employee ko cards/rate 0 bata start huncha.
        const target = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
        const targetWall = wallClockParts(target, offset);
        const targetStart = tzInstant(offset, targetWall.year, targetWall.month, targetWall.day, 0);
        const targetEnd = tzInstant(offset, targetWall.year, targetWall.month, targetWall.day, 1440);

        const settings = await CompanySettingModel.findOne().lean();
        const weeklyHolidays: string[] = settings?.weeklyHolidays || ["saturday"];
        const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(Date.UTC(targetWall.year, targetWall.month, targetWall.day)).getUTCDay()];

        // weekend ho ki nahi
        if (weeklyHolidays.includes(dayName)) return { skipped: "weekend" };

        // holiday ho ki nahi (multi-day range match - target din ko lagi)
        const holiday = await HolidayModel.findOne({
            startDate: { $lte: targetEnd },
            endDate: { $gte: targetStart },
        });
        if (holiday) {
            // holiday ma kunai record chha bhane holiday status rakhne
            await AttendanceModel.updateMany(
                { date: { $gte: targetStart, $lte: targetEnd }, status: { $in: ["present", "late"] } },
                { status: "holiday" },
            );
            return { skipped: "holiday" };
        }

        const employees = await EmployeeModel.find({ status: "active" }).select("_id branch joiningDate createdAt");

        let absentCount = 0;
        let missingCheckoutCount = 0;

        for (const employee of employees) {
            // join hunu aghiko din ko lagi kehi banaudaina - naya employee/
            // company ma false absent/leave auto na dekhau (rate 0 bata start huncha)
            const startRaw: any = (employee as any).joiningDate || (employee as any).createdAt;
            if (startRaw) {
                const startDay = new Date(startRaw);
                startDay.setHours(0, 0, 0, 0);
                const targetDay = new Date(targetWall.year, targetWall.month, targetWall.day);
                if (targetDay < startDay) continue;
            }

            const record = await AttendanceModel.findOne({
                employee: employee._id,
                date: { $gte: targetStart, $lte: targetEnd },
            });

            // approved leave ma chha ki nahi
            const onLeave = await LeaveRequestModel.findOne({
                employee: employee._id,
                status: "approved",
                startDate: { $lte: targetEnd },
                endDate: { $gte: targetStart },
            });

            if (!record) {
                // branch nabhayeko employee lai record banaudaina (Attendance schema le branch require garxa)
                const empBranch = (employee as any).branch;
                if (!empBranch) continue;

                // scheduled to work + no valid attendance => ABSENT
                if (onLeave) {
                    await AttendanceModel.create({
                        employee: employee._id,
                        branch: empBranch,
                        date: targetStart,
                        status: "leave",
                        workingMinutes: 0,
                    });
                } else {
                    await AttendanceModel.create({
                        employee: employee._id,
                        branch: empBranch,
                        date: targetStart,
                        status: "absent",
                        workingMinutes: 0,
                    });
                    absentCount++;
                }
            } else if (record.checkIn?.time && !record.checkOut?.time && !onLeave) {
                // check-in garyo tara checkout birsincha -> missing_checkout
                record.status = "missing_checkout";
                await record.save();
                missingCheckoutCount++;

                // employee lai missing checkout ko notification
                await NotificationService.notifyMissingCheckout(
                    employee._id.toString(),
                    targetStart,
                );
            }
        }

        return { absentCount, missingCheckoutCount };
    }

    // hourly check - kaam sakiyepachi (workingEndTime pachadi) ek choti matra run garne
    static start() {
        if (this.timer) return;

        this.timer = setInterval(async () => {
            try {
                const now = new Date();
                const todayKey = nptTodayKey(now); // Nepal calendar day (toISOString is UTC)

                // din ma ek choti matra
                if (this.lastRunDate === todayKey) return;

                // 7 PM pachadi matra run garne (kaam sakira)
                if (nptHour(now) < 19) return; // 7 PM Nepal time, any server TZ

                this.lastRunDate = todayKey;
                const result = await this.runForDate(now);
                console.log("[AbsenceJob] ran:", JSON.stringify(result));
            } catch (error) {
                console.error("[AbsenceJob] failed:", error);
            }
        }, 30 * 60 * 1000); // 30 minute ma ek choti check

        console.log("[AbsenceJob] scheduler started");
    }

    static stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

export default AbsenceJob;
