import z from "zod";

export const CreateLeaveRequestDTO = z.object({
    leaveType: z.string().min(1),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    reason: z.string().min(5),
});

export const UpdateLeaveRequestDTO = z.object({
    leaveType: z.string().min(1).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    reason: z.string().min(5).optional(),
});

export const ApproveLeaveRequestDTO = z.object({
    status: z.enum(["approved", "rejected"]),
    remark: z.string().optional(),
});
