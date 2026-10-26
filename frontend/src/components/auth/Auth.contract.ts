import { z } from "zod";

export const LoginSchema = z.object({
  email: z
    .email("Please enter a valid email")
    .nonempty("Email is required"),

  password: z
    .string()
    .min(1, "Password is required"),
});

export const RegisterSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Please enter a valid email"),
  username: z.string().min(2, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().regex(/^[0-9]+$/, "Phone must contain numbers only").min(7, "Phone must be at least 7 digits").max(15, "Phone must be at most 15 digits"),
});

export type ICredentials = z.infer<typeof LoginSchema>;
export type IRegisterData = z.infer<typeof RegisterSchema>;

export type UserRole =
  | "platform_admin"
  | "super_admin"
  | "hr_admin"
  | "manager"
  | "employee";

export interface ICompanyRef {
  _id: string;
  name: string;
  code: string;
  status?: string;
  logo?: { url: string } | null;
  createdAt?: string;
}

export interface IUserDetail {
  id: string;
  email: string;
  username?: string | null;
  name?: string | null;
  role: UserRole;
  status: "active" | "inactive";
  employee?: string | null;
  mustChangePassword?: boolean;
  // per-user calendar preference (profile ma user aafai chuncha)
  calendarPreference?: "bs" | "ad";
  // multi-company: null = system owner, natra company id
  companyId?: string | null;
  companyDb?: string | null;
  company?: ICompanyRef | null;
  // company superadmin lai diiyeko sidebar/function permissions
  permissions?: string[];
}

export interface ILoginResponse {
  accessToken: string;
  user: IUserDetail;
}