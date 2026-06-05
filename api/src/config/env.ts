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
    GOOGLE_DRIVE_ENABLED: optionalBooleanString,
    GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string().min(1).optional(),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1).optional()
  })
  .superRefine((value, context) => {
    if (!value.GOOGLE_DRIVE_ENABLED) {
      return;
    }

    const googleKeys = [
      "GOOGLE_DRIVE_ROOT_FOLDER_ID",
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    ] as const;

    googleKeys.forEach((key) => {
      if (value[key] === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} es obligatorio cuando se configura Google Drive`,
          path: [key]
        });
      }
    });
  });

export const env = envSchema.parse(process.env);
