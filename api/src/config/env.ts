import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const optionalBooleanString = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(3001),
    CORS_ORIGIN: z.string().min(1),
    HERMES_BASE_URL: z.string().url(),
    HERMES_SHARED_SECRET: z.string().min(1),
    HERMES_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_SECURE: optionalBooleanString,
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    SMTP_FROM: z.string().email().optional(),
    DAILY_REPORT_DEFAULT_EMAIL: z.string().email().optional()
  })
  .superRefine((value, context) => {
    const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;
    const hasAnySmtpConfig = smtpKeys.some((key) => value[key] !== undefined);

    if (!hasAnySmtpConfig) {
      return;
    }

    smtpKeys.forEach((key) => {
      if (value[key] === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} es obligatorio cuando se configura el envio SMTP`,
          path: [key]
        });
      }
    });
  });

export const env = envSchema.parse(process.env);
