import z from "zod";

// select ma "" (not selected) aayo bhane undefined banaidine
const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);

const phoneSchema = z
    .string()
    .regex(/^[0-9]+$/, "Phone must contain numbers only")
    .min(7, "Phone must be at least 7 digits")
    .max(15, "Phone must be at most 15 digits");

export const CreateEmployeeDTO = z.object({
    employeeId: z.string().min(2),
    name: z.string().min(2),
    email: z.email(),
    phone: phoneSchema,
    department: z.string().optional(),
    designation: z.string().optional(),
    branch: z.string().optional(),
    manager: z.string().optional(),
    joiningDate: z.string().optional(),
    // gender-targeted holiday ra reports ko lagi
    gender: z.preprocess(emptyToUndef, z.enum(["male", "female", "other"]).optional()),
});

export const UpdateEmployeeDTO = z.object({
    name: z.string().min(2).optional(),
    email: z.email().optional(),
    phone: phoneSchema.optional(),
    department: z.string().optional(),
    designation: z.string().optional(),
    branch: z.string().optional(),
    manager: z.string().optional(),
    joiningDate: z.string().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    gender: z.preprocess(emptyToUndef, z.enum(["male", "female", "other"]).optional()),
});