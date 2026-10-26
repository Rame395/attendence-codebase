import z from "zod";

// empty select "" lai undefined banaune (EmployeeRequest jastai)
const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);

export const CreateUserDTO = z.object({
  name: z
    .string()
    .min(3)
    .max(50),

  email: z.email(),

  username: z.preprocess(
    emptyToUndef,
    z
      .string()
      .min(2)
      .max(50)
      .regex(
        /^[a-zA-Z0-9_. -]+$/,
        "Username can only contain letters, numbers, spaces, _ . -",
      )
      .optional(),
  ),

  phone: z
    .string()
    .regex(/^[0-9]+$/, "Phone must contain numbers only")
    .min(7)
    .max(15),

  employeeId: z
    .string()
    .min(2),

  gender: z.preprocess(
    emptyToUndef,
    z.enum(["male", "female", "other"]).optional(),
  ),


  role: z.enum([
    "hr_admin",
    "manager",
    "employee",
  ]),

  department: z
    .string()
    .optional()
    .nullable(),

  designation: z
    .string()
    .optional()
    .nullable(),

  branch: z
    .string()
    .optional()
    .nullable(),

  manager: z
    .string()
    .optional()
    .nullable(),

  joiningDate: z.preprocess(
    emptyToUndef,
    z.string().optional().nullable(),
  ),

  departmentName: z
    .string()
    .optional()
    .nullable(),

  branchName: z
    .string()
    .optional()
    .nullable(),

  // kun company ma user banaune (owner le matra arko company dina pauxa)
  companyId: z
    .string()
    .optional()
    .nullable(),
});

// user update ko lagi - role, status, email + linked employee profile fields
export const UpdateUserDTO = z.object({
  email: z.email().optional(),

  role: z.preprocess(
    emptyToUndef,
    z.enum(["hr_admin", "manager", "employee"]).optional(),
  ),

  status: z.preprocess(
    emptyToUndef,
    z.enum(["active", "inactive"]).optional(),
  ),

  name: z
    .string()
    .min(3)
    .max(50)
    .optional(),

  phone: z
    .string()
    .regex(/^[0-9]+$/, "Phone must contain numbers only")
    .min(7)
    .max(15)
    .optional(),

  gender: z.preprocess(
    emptyToUndef,
    z.enum(["male", "female", "other"]).optional(),
  ),

  department: z
    .string()
    .optional()
    .nullable(),

  designation: z
    .string()
    .optional()
    .nullable(),

  branch: z
    .string()
    .optional()
    .nullable(),

  manager: z
    .string()
    .optional()
    .nullable(),

  joiningDate: z.preprocess(
    emptyToUndef,
    z.string().optional().nullable(),
  ),
});
