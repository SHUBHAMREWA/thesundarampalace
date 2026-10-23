import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});
export type TotpCodeInput = z.infer<typeof totpCodeSchema>;

export const backupCodeSchema = z.object({
  code: z.string().trim().min(6, "Enter one of your backup codes"),
});

export const passwordConfirmSchema = z.object({
  password: z.string().min(1, "Enter your password"),
});
