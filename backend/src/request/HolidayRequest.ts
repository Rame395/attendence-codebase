import z from "zod";

// appliesTo = "branch" huda branches chaina parchha, "department" huda departments
const scopeRefinement = (data: {
    appliesTo?: string;
    branches?: string[];
    departments?: string[];
}) => {
    if (data.appliesTo === "branch" && (!data.branches || data.branches.length === 0)) return false;
    if (data.appliesTo === "department" && (!data.departments || data.departments.length === 0)) return false;
    return true;
};

export const CreateHolidayDTO = z
    .object({
        title: z.string().min(2),
        description: z.string().optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        appliesTo: z.enum(["all", "branch", "department"]).default("all"),
        branches: z.array(z.string()).optional().default([]),
        departments: z.array(z.string()).optional().default([]),
        gender: z.enum(["both", "male", "female"]).default("both"),
    })
    .refine(scopeRefinement, {
        message: "Selected branch(es) or department(s) are required for this scope",
    });

export const UpdateHolidayDTO = z
    .object({
        title: z.string().min(2).optional(),
        description: z.string().optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        appliesTo: z.enum(["all", "branch", "department"]).optional(),
        branches: z.array(z.string()).optional(),
        departments: z.array(z.string()).optional(),
        gender: z.enum(["both", "male", "female"]).optional(),
    })
    .refine(scopeRefinement, {
        message: "Selected branch(es) or department(s) are required for this scope",
    });
