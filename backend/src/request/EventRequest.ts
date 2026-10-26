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

export const CreateEventDTO = z.object({
    title: z.string().min(2).max(200),
    type: eventTypeEnum,
    date: dateSchema,
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    branch: z.string().optional(),
    isForAllEmployees: z.boolean().optional().default(true),
    targetType: z.enum(["all", "branch", "department", "employee", "role"]).optional().default("all"),
    department: z.string().optional(),
    employee: z.string().optional(),
    roles: z.array(z.string()).optional(),
});

export const UpdateEventDTO = CreateEventDTO.partial();
