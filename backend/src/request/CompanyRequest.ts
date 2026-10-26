import z from "zod";

import { PERMISSION_KEYS } from "../utils/permissions.js";

// company create/update DTOs - create garda superadmin pani sangai banauna milcha
const InlineSuperAdminDTO = z.object({
  name: z.string().min(2).max(50),
  email: z.email(),
  permissions: z
    .array(z.enum(PERMISSION_KEYS))
    .min(1, "Select at least one function"),
});

export const CreateCompanyDTO = z.object({
  name: z.string().min(2).max(80),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Code can only contain letters, numbers, _ and -",
    ),
  status: z.enum(["active", "inactive"]).optional(),
  superadmin: InlineSuperAdminDTO.optional(),
});

export const UpdateCompanyDTO = z.object({
  name: z.string().min(2).max(80).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const CreateCompanySuperAdminDTO = z.object({
  name: z.string().min(2).max(50),
  email: z.email(),
  permissions: z
    .array(z.enum(PERMISSION_KEYS))
    .min(1, "Select at least one function"),
});

export const UpdateCompanySuperAdminDTO = z.object({
  permissions: z.array(z.enum(PERMISSION_KEYS)).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
