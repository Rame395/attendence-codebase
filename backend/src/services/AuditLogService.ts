import mongoose from "mongoose";
import AuditLogModel from "../model/AuditLogModel.js";
import UserModel from "../model/UserModel.js";
import { currentDbName } from "../config/tenantStore.js";
import { CENTRAL_DB_NAME } from "../config/tenant.js";

// audit log service
class AuditLogService {
    // role lai display name - name nabhayeko account (super_admin) ko lagi
    private static roleLabel(role?: string | null): string | null {
        const map: Record<string, string> = {
            platform_admin: "Platform Admin",
            super_admin: "Super Admin",
            hr_admin: "HR Admin",
            manager: "Manager",
            employee: "Employee",
        };
        return (role && map[role]) || null;
    }

    // performer ko display name - employee name, username, role label
    static async resolvePerformerName(userId: string | undefined): Promise<string | null> {
        if (!userId) return null;
        if (userId === "platform-admin") return "Platform Admin";
        try {
            const user: any = await UserModel.findById(userId)
                .select("username role employee")
                .populate("employee", "name")
                .lean();
            if (!user) return null;
            return user.employee?.name || user.username || this.roleLabel(user.role);
        } catch {
            return null;
        }
    }

    // action log garne - jasto: attendance modified, correction approved etc.
    static async logAction(
        performedBy: string | undefined,
        action: string,
        module: string,
        options: {
            targetId?: string;
            employee?: string;
            oldData?: any;
            newData?: any;
            reason?: string;
            ipAddress?: string;
        } = {},
    ) {
        try {
            // Platform Admin central context ma audit record na banne
            const dbName = currentDbName();
            if (!dbName || dbName === CENTRAL_DB_NAME) return null;

            return await AuditLogModel.create({
                // platform-admin sub ObjectId hoina - ref cast error bata jogina
                performedBy: (performedBy && mongoose.isObjectIdOrHexString(performedBy)
                    ? performedBy
                    : undefined) as any,
                performedByName: await this.resolvePerformerName(performedBy),
                action,
                module,
                targetId: (options.targetId ?? undefined) as any,
                employee: (options.employee ?? undefined) as any,
                oldData: options.oldData ?? null,
                newData: options.newData ?? null,
                reason: options.reason ?? null,
                ipAddress: options.ipAddress ?? null,
            });
        } catch {
            // audit fail bhaye pani main flow rokne hudaina
        }
    }

    static async getAuditLogs(filters: {
        module?: string;
        action?: string;
        performedBy?: string;
        employee?: string;
    } = {}, limit = 100, offset = 0) {
        const query: any = {};

        if (filters.module) query.module = filters.module;
        if (filters.action) query.action = filters.action;
        if (filters.performedBy) query.performedBy = filters.performedBy;
        if (filters.employee) query.employee = filters.employee;

        const [data, total] = await Promise.all([
            AuditLogModel.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(offset)
                // performedBy ko employee name populate garne (audit history ma "By UserName")
                .populate({
                    path: "performedBy",
                    select: "email role username employee",
                    populate: { path: "employee", select: "name" },
                })
                .populate("employee", "name employeeId")
                .lean(),
            AuditLogModel.countDocuments(query),
        ]);

        return { data, total, limit, offset };
    }

    // euta audit log delete garne - database batai permanantly hatxa
    static async deleteAuditLog(id: string) {
        return await AuditLogModel.findByIdAndDelete(id);
    }

    // sabai audit history delete garne
    static async clearAuditLogs() {
        return await AuditLogModel.deleteMany({});
    }
}

export default AuditLogService;
