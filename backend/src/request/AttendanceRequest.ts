import z from "zod";

// model ko status enum sanga match garne
export const attendanceStatusEnum = z.enum([
    "present",
    "absent",
    "late",
    "half_day",
    "leave",
    "holiday",
    "weekend",
    "missing_checkin",
    "missing_checkout",
]);

// admin/HR le manually attendance mark garne
export const MarkAttendanceDTO = z.object({
    employee: z.string().min(1, "Employee is required"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    // "HH:mm" format (optional - absent/holiday ma time hunna)
    checkInTime: z.string().optional(),
    checkOutTime: z.string().optional(),
    status: attendanceStatusEnum.optional(),
});

// existing record edit garne
export const UpdateAttendanceDTO = z.object({
    checkInTime: z.string().optional(),
    checkOutTime: z.string().optional(),
    status: attendanceStatusEnum.optional(),
});
