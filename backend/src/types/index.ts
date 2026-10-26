export type UserRole =
  | "platform_admin"
  | "super_admin"
  | "hr_admin"
  | "manager"
  | "employee";

export interface AuthUser {
  _id: string;
  name?: string;
  email: string;
  username?: string;
  phone?: string;
  role: UserRole;
  image?: any;
  address?: string;
  mustChangePassword?: boolean;
  // kun company database ko user ho (central/system owner lai central db naam)
  companyDb?: string;
  // kun company ko user ho (null = system owner)
  company?: string | null;
}
