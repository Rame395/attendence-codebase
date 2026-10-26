import NotificationModel from "../model/NotificationModel.js";
import UserModel from "../model/UserModel.js";
import EmployeeModel from "../model/EmployeeModel.js";

// notification ko service - sabai notification create/read garna use hunxa
class NotificationService {
    // naya notification banaune
    static async createNotification(userId: string, title: string, message: string, type: string) {
        return await NotificationModel.create({
            user: userId,
            title,
            message,
            type: type as any,
        });
    }

    // employee ko user._id nikalne (employee ref bata)
    static async getUserIdFromEmployee(employeeId: string): Promise<string | null> {
        const user = await UserModel.findOne({ employee: employeeId }).select("_id").lean();
        return user?._id?.toString() ?? null;
    }

    static async getMyNotifications(userId: string, limit = 30) {
        // array return garne - frontend le directly .map garna pauxa
        return await NotificationModel.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    static async getUnreadCount(userId: string) {
        return await NotificationModel.countDocuments({ user: userId, isRead: false });
    }

    static async markAsRead(notificationId: string, userId: string) {
        return await NotificationModel.findOneAndUpdate(
            { _id: notificationId, user: userId },
            { isRead: true, readAt: new Date() },
            { new: true },
        );
    }

    static async markAllAsRead(userId: string) {
        const result = await NotificationModel.updateMany(
            { user: userId, isRead: false },
            { isRead: true, readAt: new Date() },
        );
        return result;
    }

    static async deleteNotification(notificationId: string, userId: string) {
        return await NotificationModel.findOneAndDelete({ _id: notificationId, user: userId });
    }

    static async deleteAll(userId: string) {
        return await NotificationModel.deleteMany({ user: userId });
    }

    // admin le user/employee ko info update garda tyo user lai notify garne
    static async notifyInfoUpdate(userId: string, title: string, message: string) {
        try {
            if (!userId) return;
            await this.createNotification(userId, title, message, "info_update");
        } catch {
            // notification fail bhaye pani main flow ma asar parne hudaina
        }
    }

    // check-in successful bhayeko notify garne
    static async notifyCheckIn(employeeId: string, late: boolean) {
        try {
            const userId = await this.getUserIdFromEmployee(employeeId);
            if (!userId) return;
            if (late) {
                await this.createNotification(userId, "Late Arrival", "You checked in late today.", "late");
            } else {
                await this.createNotification(userId, "Check-in Confirmed", "Your check-in has been recorded successfully.", "check_in");
            }
        } catch {
            // notification fail bhaye pani main flow ma asar parne hudaina
        }
    }

    // direct manager lai notify garne (manager team-scoped ho)
    static async notifyDirectManager(employeeId: string, title: string, message: string, type: string) {
        try {
            const emp: any = await EmployeeModel.findById(employeeId).select("manager").lean();
            const mgrRaw = emp?.manager;
            if (!mgrRaw) return;
            const mgrEmpId = mgrRaw?._id?.toString?.() ?? mgrRaw.toString();
            const user = await UserModel.findOne({
                employee: mgrEmpId,
                role: "manager",
                status: "active",
            })
                .select("_id")
                .lean();
            if (user) {
                await this.createNotification(user._id.toString(), title, message, type);
            }
        } catch {
            // notification fail bhaye pani main flow ma asar parne hudaina
        }
    }

    // employee check-in garda super_admin + hr_admin + direct manager lai notify garne
    static async notifyAdminsCheckIn(employeeId: string, employeeName: string, time: Date, distance: number, late: boolean) {
        try {
            const admins = await UserModel.find({ role: { $in: ["super_admin", "hr_admin"] }, status: "active" }).select("_id").lean();
            const timeStr = time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
            await Promise.all(admins.map((a: any) =>
                this.createNotification(
                    a._id.toString(),
                    late ? "Employee Checked In (Late)" : "Employee Checked In",
                    `${employeeName} checked in at ${timeStr} (${Math.round(distance)}m from office).`,
                    "check_in",
                ),
            ));
            this.notifyDirectManager(
                employeeId,
                late ? "Team Check-in (Late)" : "Team Check-in",
                `${employeeName} checked in at ${timeStr} (${Math.round(distance)}m from office).`,
                "check_in",
            );
        } catch {
            // admin notification fail bhaye pani main flow ma asar parne hudaina
        }
    }

    // employee check-out garda super_admin + hr_admin + direct manager lai notify garne
    static async notifyAdminsCheckOut(employeeId: string, employeeName: string, time: Date, workingMinutes: number) {
        try {
            const admins = await UserModel.find({ role: { $in: ["super_admin", "hr_admin"] }, status: "active" }).select("_id").lean();
            const hours = Math.floor(workingMinutes / 60);
            const mins = workingMinutes % 60;
            await Promise.all(admins.map((a: any) =>
                this.createNotification(
                    a._id.toString(),
                    "Employee Checked Out",
                    `${employeeName} checked out at ${time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}. Working hours: ${hours}h ${mins}m`,
                    "check_out",
                ),
            ));
            this.notifyDirectManager(
                employeeId,
                "Team Check-out",
                `${employeeName} checked out at ${time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}. Working hours: ${hours}h ${mins}m`,
                "check_out",
            );
        } catch {
            // admin notification fail bhaye pani main flow ma asar parne hudaina
        }
    }

    // check-out successful bhayeko notify garne
    static async notifyCheckOut(employeeId: string, workingMinutes: number) {
        try {
            const userId = await this.getUserIdFromEmployee(employeeId);
            if (!userId) return;
            const hours = Math.floor(workingMinutes / 60);
            const mins = workingMinutes % 60;
            await this.createNotification(
                userId,
                "Check-out Confirmed",
                `Your check-out has been recorded. Working hours: ${hours}h ${mins}m`,
                "check_out",
            );
        } catch {}
    }

    // leave approve/reject bhayeko notify garne
    static async notifyLeaveStatus(employeeId: string, status: string) {
        try {
            const userId = await this.getUserIdFromEmployee(employeeId);
            if (!userId) return;
            const approved = status === "approved";
            await this.createNotification(
                userId,
                `Leave ${approved ? "Approved" : "Rejected"}`,
                approved ? "Your leave request has been approved." : "Your leave request has been rejected.",
                approved ? "leave_approved" : "leave_rejected",
            );
        } catch {}
    }

    // correction approve/reject bhayeko notify garne
    static async notifyCorrectionStatus(employeeId: string, status: string) {
        try {
            const userId = await this.getUserIdFromEmployee(employeeId);
            if (!userId) return;
            const approved = status === "approved";
            await this.createNotification(
                userId,
                `Correction ${approved ? "Approved" : "Rejected"}`,
                approved ? "Your attendance correction has been applied." : "Your attendance correction request was rejected.",
                approved ? "correction_approved" : "correction_rejected",
            );
        } catch {}
    }

    // naya event/training bhayeko targeted recipients lai notify garne
    static async notifyEvent(event: any) {
        try {
            const title = event.title || "New Event";
            const datePart = event.date
                ? new Date(event.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
                : "";
            const message = `${datePart}${event.location ? " at " + event.location : ""}`.trim();

            let userIds: string[] = [];
            const targetType = event.targetType || (event.isForAllEmployees ? "all" : event.branch ? "branch" : "all");

            if (targetType === "all") {
                const users = await UserModel.find({ status: "active" }).select("_id").lean();
                userIds = users.map((u: any) => u._id.toString());
            } else if (targetType === "branch" && event.branch) {
                const employees = await EmployeeModel.find({ branch: event.branch, status: "active" }).select("_id").lean();
                const employeeIds = employees.map((e: any) => e._id);
                const users = await UserModel.find({ employee: { $in: employeeIds }, status: "active" }).select("_id").lean();
                userIds = users.map((u: any) => u._id.toString());
            } else if (targetType === "department" && event.department) {
                const employees = await EmployeeModel.find({ department: event.department, status: "active" }).select("_id").lean();
                const employeeIds = employees.map((e: any) => e._id);
                const users = await UserModel.find({ employee: { $in: employeeIds }, status: "active" }).select("_id").lean();
                userIds = users.map((u: any) => u._id.toString());
            } else if (targetType === "employee" && event.employee) {
                const eid = event.employee?._id ?? event.employee;
                const user = await UserModel.findOne({ employee: eid, status: "active" }).select("_id").lean();
                if (user) userIds = [user._id.toString()];
            } else if (targetType === "role" && Array.isArray(event.roles) && event.roles.length) {
                const users = await UserModel.find({ role: { $in: event.roles }, status: "active" }).select("_id").lean();
                userIds = users.map((u: any) => u._id.toString());
            }

            if (!userIds.length) return;

            await Promise.all(userIds.map((uid) =>
                this.createNotification(uid, title, message, "event"),
            ));
        } catch {
            // notification fail bhaye pani event creation rukna hudaina
        }
    }

    // checkout birseko employee lai notify garne
    static async notifyMissingCheckout(employeeId: string, date: Date) {
        try {
            const userId = await this.getUserIdFromEmployee(employeeId);
            if (!userId) return;
            const dateStr = new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
            await this.createNotification(
                userId,
                "Missing Checkout",
                `You did not check out on ${dateStr}. Please contact HR for a correction.`,
                "missing_checkout",
            );
        } catch {}
    }

    // correction request aayeko super_admin/hr_admin + direct manager notify
    static async notifyAdminsCorrectionRequest(employeeId: string, empName: string, dateStr: string, reason: string) {
        try {
            const admins = await UserModel.find({ role: { $in: ["super_admin", "hr_admin"] }, status: "active" }).select("_id").lean();
            await Promise.all(admins.map((a: any) =>
                this.createNotification(
                    a._id.toString(),
                    "Attendance Correction Request",
                    `${empName} requested an attendance correction for ${dateStr}. Reason: ${reason}`,
                    "correction_requested",
                ),
            ));
            this.notifyDirectManager(
                employeeId,
                "Team Correction Request",
                `${empName} requested an attendance correction for ${dateStr}. Reason: ${reason}`,
                "correction_requested",
            );
        } catch {}
    }

    // leave request aayeko super_admin/hr_admin + direct manager lai notify garne
    static async notifyAdminsLeaveRequest(employeeId: string, empName: string, startStr: string, endStr: string, reason: string) {
        try {
            const admins = await UserModel.find({ role: { $in: ["super_admin", "hr_admin"] }, status: "active" }).select("_id").lean();
            await Promise.all(admins.map((a: any) =>
                this.createNotification(
                    a._id.toString(),
                    "Leave Request",
                    `${empName} requested leave from ${startStr} to ${endStr}. Reason: ${reason}`,
                    "leave_requested",
                ),
            ));
            this.notifyDirectManager(
                employeeId,
                "Team Leave Request",
                `${empName} requested leave from ${startStr} to ${endStr}. Reason: ${reason}`,
                "leave_requested",
            );
        } catch {}
    }
}

export default NotificationService;
