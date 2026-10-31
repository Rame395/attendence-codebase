import z from "zod";

// event type enum - model sanga match garne
export const eventTypeEnum = z.enum([
    "holiday",
    "company_event",
    "staff_training",
    "meeting",
    "other",
]);

const dateSchema = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const BaseEventSchema = z.object({
    title: z.string().min(2).max(200),
    type: eventTypeEnum,
    date: dateSchema,
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    branch: z.string().optional().nullable(),
    isForAllEmployees: z.boolean().optional(),
    targetType: z.enum(["all", "branch", "department", "employee", "role"]).optional(),
    department: z.string().optional().nullable(),
    employee: z.string().optional().nullable(),
    roles: z.array(z.string()).optional(),
});

const validateTimeOrder = (data: { startTime?: string | undefined; endTime?: string | undefined }) => {
    const start = data.startTime?.trim();
    const end = data.endTime?.trim();
    if (start && end) {
        return end > start;
    }
    return true;
};

export const CreateEventDTO = BaseEventSchema.refine(validateTimeOrder, {
    message: "End time must be after start time",
    path: ["endTime"],
});

export const UpdateEventDTO = BaseEventSchema.partial().refine(validateTimeOrder, {
    message: "End time must be after start time",
    path: ["endTime"],
});
