import z from "zod"

export const LoginDTO = z.object({
  email: z.email().nonempty().nonoptional(),
  password: z.string().nonempty().nonoptional(),
});


export const RegisterDTO = z.object({
  email: z.email().nonempty(),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d])(?=.*[\W]).{8,25}$/, "Password must be a strong password"),
});

export const ChangeFirstPasswordDTO = z.object({
  newPassword: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d])(?=.*[\W]).{8,25}$/, "Password must be 8-25 characters and include uppercase, lowercase, number and special character"),
});

export const ChangePasswordDTO = z.object({
  oldPassword: z.string().nonempty(),
  newPassword: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d])(?=.*[\W]).{8,25}$/, "Password must be a strong password"),
});

export const ForgotPasswordDTO = z.object({

  email: z
    .email("Please enter a valid email")
    .nonempty("Email is required"),

});


export const ResetPasswordDTO = z.object({

  email: z
    .email("Please enter a valid email"),

  code: z
    .string()
    .length(6, "Code must be 6 digits"),

  password: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d])(?=.*[\W]).{8,25}$/,
      "Password must be 8-25 characters and include uppercase, lowercase, number and special character",
    ),

});


export type IImageType = {
  filename: string,
  path: string,
  type: string,
  size: number,
  url: string,
}

export type IUserRegister = z.infer<typeof RegisterDTO> & {
  image?: IImageType
}


export const UpdateOwnProfileDTO = z.object({
  name: z.string().min(2).max(50).optional(),
  email: z.email().optional(),
  phone: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().regex(/^[0-9]+$/, "Phone must contain numbers only").min(7).max(15).optional(),
  ),
  gender: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["male", "female", "other"]).optional(),
  ),
  calendarPreference: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["bs", "ad"]).optional(),
  ),
});

export type IUpdateOwnProfile = z.infer<typeof UpdateOwnProfileDTO>;
