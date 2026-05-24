import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().min(1),
  HERMES_BASE_URL: z.string().url(),
  HERMES_SHARED_SECRET: z.string().min(1),
  HERMES_TIMEOUT_MS: z.coerce.number().int().positive().default(15000)
});

export const env = envSchema.parse(process.env);

