import type { Request, Response, NextFunction } from "express";
import EventService from "../services/EventService.js";
import { saveUploadedFile } from "../utils/fileStorage.js";
import UserModel from "../model/UserModel.js";
import NotificationService from "../services/NotificationService.js";
import AuditLogService from "../services/AuditLogService.js";

class EventController {
    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const role = req.loggedInUser?.role;
            let events;

            // admin roles sabai events dekhauxa, employee aafno targeting anusar matra
            if (role === "super_admin" || role === "hr_admin" || role === "manager") {
                events = await EventService.getAllEvents();
            } else {
                const user: any = await UserModel.findById(req.loggedInUser?._id)
                    .populate("employee", "branch department");

                const employee = user?.employee;
                const branchId = employee?.branch?._id ?? employee?.branch ?? null;
                const deptId = employee?.department?._id ?? employee?.department ?? null;
                const employeeId = employee?._id ?? null;
                const userRole = role;

                const or: any[] = [];

                // legacy/global events
                or.push({ isForAllEmployees: true });

                // branch-targeted
                if (branchId) {
                    or.push({ targetType: "branch", branch: branchId });
                    or.push({ branch: branchId });
                }

                // department-targeted
                if (deptId) {
                    or.push({ targetType: "department", department: deptId });
                }

                // employee-targeted
                if (employeeId) {
                    or.push({ targetType: "employee", employee: employeeId });
                }

                // role-targeted
                if (userRole) {
                    or.push({ targetType: "role", roles: userRole });
                }

                events = await EventService.getAllEvents({ $or: or });
            }

            res.json({
                data: events,
                message: "Events fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid event ID" };
            }

            const event = await EventService.getEventById(id);

            if (!event) {
                throw { code: 404, message: "Event not found" };
            }

            res.json({
                data: event,
                message: "Event fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // event targeting normalize garne - targetType anusar irrelevant fields clear garne
    private normalizeTargeting(payload: any) {
        const p = { ...payload };
        if (p.startTime && p.endTime && String(p.endTime).trim() <= String(p.startTime).trim()) {
            throw { code: 422, message: "End time must be after start time" };
        }

        let targetType = p.targetType;
        if (p.isForAllEmployees === false && (!targetType || targetType === "all")) {
            if (p.branch) targetType = "branch";
            else if (p.department) targetType = "department";
            else if (p.employee) targetType = "employee";
            else if (Array.isArray(p.roles) && p.roles.length > 0) targetType = "role";
            else targetType = "branch";
        } else if (p.isForAllEmployees === true) {
            targetType = "all";
        } else if (!targetType) {
            targetType = p.branch
                ? "branch"
                : p.department
                  ? "department"
                  : p.employee
                    ? "employee"
                    : Array.isArray(p.roles) && p.roles.length > 0
                      ? "role"
                      : "all";
        }
        p.targetType = targetType;

        if (!p.branch) p.branch = null;
        if (!p.department) p.department = null;
        if (!p.employee) p.employee = null;
        if (!Array.isArray(p.roles)) p.roles = [];

        // targetType anusar irrelevant fields hataidine taaki inconsistent state na hos
        switch (targetType) {
            case "all":
                p.isForAllEmployees = true;
                p.branch = null;
                p.department = null;
                p.employee = null;
                p.roles = [];
                break;
            case "branch":
                p.isForAllEmployees = false;
                p.department = null;
                p.employee = null;
                p.roles = [];
                break;
            case "department":
                p.isForAllEmployees = false;
                p.branch = null;
                p.employee = null;
                p.roles = [];
                break;
            case "employee":
                p.isForAllEmployees = false;
                p.branch = null;
                p.department = null;
                p.roles = [];
                break;
            case "role":
                p.isForAllEmployees = false;
                p.branch = null;
                p.department = null;
                p.employee = null;
                break;
        }
        return p;
    }

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const payload = this.normalizeTargeting({ ...req.body });

            const event = await EventService.createEvent({
                ...payload,
                createdBy: req.loggedInUser?._id,
            });

            await AuditLogService.logAction(
                req.loggedInUser?._id?.toString(),
                "Event Created",
                "event",
                {
                    targetId: (event as any)?._id?.toString(),
                    newData: {
                        title: (event as any)?.title,
                        type: (event as any)?.type,
                        date: (event as any)?.date,
                        targetType: (event as any)?.targetType,
                    },
                    ipAddress: req.ip,
                },
            );

            // notify active users
            NotificationService.notifyEvent(event);

            res.status(201).json({
                data: event,
                message: "Event created successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid event ID" };
            }

            const payload = this.normalizeTargeting({ ...req.body });

            const event = await EventService.updateEvent(id, {
                ...payload,
                updatedBy: req.loggedInUser?._id,
            });

            if (!event) {
                throw { code: 404, message: "Event not found" };
            }

            await AuditLogService.logAction(
                req.loggedInUser?._id?.toString(),
                "Event Updated",
                "event",
                {
                    targetId: id,
                    newData: {
                        title: (event as any)?.title,
                        type: (event as any)?.type,
                        date: (event as any)?.date,
                        targetType: (event as any)?.targetType,
                    },
                    ipAddress: req.ip,
                },
            );

            res.json({
                data: event,
                message: "Event updated successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid event ID" };
            }

            const event = await EventService.deleteEvent(id);

            if (!event) {
                throw { code: 404, message: "Event not found" };
            }

            await AuditLogService.logAction(
                req.loggedInUser?._id?.toString(),
                "Event Deleted",
                "event",
                {
                    targetId: id,
                    oldData: {
                        title: (event as any)?.title,
                        type: (event as any)?.type,
                        date: (event as any)?.date,
                    },
                    ipAddress: req.ip,
                },
            );

            res.json({
                data: null,
                message: "Event deleted successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    getUpcoming = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const events = await EventService.getUpcomingEvents(30);

            res.json({
                data: events,
                message: "Upcoming events fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    // attachment upload - admin/HR le event ma file attach garne
    uploadAttachment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid event ID" };
            }

            const file: any = req.file;

            if (!file) {
                throw { code: 422, message: "No file uploaded" };
            }

            const event = await EventService.updateEvent(id, {
                attachment: await saveUploadedFile(file, "events"),
            });

            if (!event) {
                throw { code: 404, message: "Event not found" };
            }

            res.json({
                data: event,
                message: "Attachment uploaded successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

export default EventController;
