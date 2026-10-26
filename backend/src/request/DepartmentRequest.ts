import z from "zod";

export const CreateDepartmentDTO = z.object({
    name: z.string().min(2).max(100),
    code: z.string().min(2).max(20),
    description: z.string().optional(),
    branch: z.string().optional().nullable(),
});

export const UpdateDepartmentDTO = z.object({
    name: z.string().min(2).max(100).optional(),
    code: z.string().min(2).max(20).optional(),
    description: z.string().optional(),
    branch: z.string().optional().nullable(),
    status: z.enum(["active", "inactive"]).optional(),
});
