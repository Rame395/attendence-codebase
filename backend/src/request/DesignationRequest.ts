import z from "zod";

export const CreateDesignationDTO = z.object({
    name: z.string().min(2).max(100),
    description: z.string().optional(),
    branch: z.string().optional().nullable(),
    department: z.string().optional().nullable(),
});

export const UpdateDesignationDTO = z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().optional(),
    branch: z.string().optional().nullable(),
    department: z.string().optional().nullable(),
    status: z.enum(["active", "inactive"]).optional(),
});
