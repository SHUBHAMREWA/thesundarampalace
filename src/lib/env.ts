import "server-only";

import { z } from "zod";

/**
 * Server environment, validated once at first use. Staging and production
 * refuse to run with missing or placeholder secrets.
 */
const schema = z
  .object({
    APP_ENV: z
      .enum(["development", "test", "staging", "production"])
      .default("development"),
    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.string().startsWith("postgres"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    CRON_SECRET: z.string().min(16),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const strict = env.APP_ENV === "staging" || env.APP_ENV === "production";
    if (!strict) return;
    for (const key of ["BETTER_AUTH_SECRET", "CRON_SECRET"] as const) {
      if (env[key].includes("change-me")) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "placeholder secret in staging/production",
        });
      }
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration — ${fields}`);
  }
  cached = parsed.data;
  return cached;
}
