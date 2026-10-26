import LeaveRequestModel from "../model/LeaveRequestModel.js";
import EmployeeModel from "../model/EmployeeModel.js";
import AttendanceModel from "../model/AttendanceModel.js";
import NotificationService from "./NotificationService.js";

class LeaveService {
    static async createLeaveRequest(data: any, employeeId: string) {
        const employee = await EmployeeModel.findById(employeeId);
        if (!employee) {
            throw { code: 404, message: "Employee not found" };
        }

        const leaveRequest = await LeaveRequestModel.create({
            employee: employeeId,
            ...data,
            status: "pending",
        });

        const populated = await leaveRequest.populate("employee", "name email employeeId");

        // admins/HR/manager lai notify garne
        const empName = (populated.employee as any)?.name || "An employee";
        const startStr = new Date(data.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        const endStr = new Date(data.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        NotificationService.notifyAdminsLeaveRequest(employeeId, empName, startStr, endStr, data.reason || "No reason provided");

        return populated;
    }

    static async getLeaveRequests(filter: any = {}) {
        return await LeaveRequestModel.find(filter)
            .populate("employee", "name email employeeId")
            .populate("reviewedBy", "email")
            .sort({ createdAt: -1 });
    }

    static async getLeaveRequestById(id: string) {
        return await LeaveRequestModel.findById(id)
            .populate("employee", "name email employeeId")
            .populate("reviewedBy", "email");
    }

    static async updateLeaveRequest(id: string, data: any) {
        return await LeaveRequestModel.findByIdAndUpdate(id, data, { new: true })
            .populate("employee", "name email employeeId")
            .populate("reviewedBy", "email");
    }

    static async approveLeaveRequest(id: string, status: "approved" | "rejected", reviewedById: string) {
        const leave = await LeaveRequestModel.findByIdAndUpdate(
            id,
            {
                status,
                reviewedBy: reviewedById,
                reviewedAt: new Date(),
            },
            { new: true }
        )
            .populate("employee", "name email employeeId")
            .populate("reviewedBy", "email");

        if (!leave) {
            throw { code: 404, message: "Leave request not found" };
        }

        // approve bhaye leave dates ma attendance "leave" status update
        if (status === "approved") {
            try {
                const start = new Date(leave.startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(leave.endDate);
                end.setHours(23, 59, 59, 999);

                const records = await AttendanceModel.find({
                    employee: leave.employee,
                    date: { $gte: start, $lte: end },
                });

                for (const record of records) {
                    record.status = "leave";
                    await record.save();
                }
            } catch {
                // attendance sync fail bhaye pani leave approve bhayeko rakhne
            }
        }

        // employee lai notify garne
        const empId = (leave.employee as any)?._id?.toString() ?? "";
        await NotificationService.notifyLeaveStatus(empId, status);

        return leave;
    }

    static async deleteLeaveRequest(id: string) {
        return await LeaveRequestModel.findByIdAndDelete(id);
    }

    static async getMyLeaveRequests(employeeId: string) {
        return await LeaveRequestModel.find({ employee: employeeId })
            .sort({ createdAt: -1 });
    }
}

export default LeaveService;
