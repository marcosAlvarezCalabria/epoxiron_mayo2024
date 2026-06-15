import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const optionalBooleanString = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

const booleanStringWithDefaultFalse = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const voiceParserProviderSchema = z.enum(["ollama", "openai-compatible"]);
const voiceTranscriberProviderSchema = z.enum(["openai", "ollama", "gemini"]);

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    CORS_ORIGIN: z.string().min(1),
    HERMES_BASE_URL: z.string().url(),
    HERMES_SHARED_SECRET: z.string().min(1),
    HERMES_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
    VOICE_PARSER_PROVIDER: voiceParserProviderSchema.default("ollama"),
    VOICE_PARSER_BASE_URL: z.string().url().optional(),
    VOICE_PARSER_MODEL: z.string().min(1).optional(),
    VOICE_PARSER_API_KEY: z.string().optional(),
    VOICE_PARSER_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    OLLAMA_BASE_URL: z.string().url().optional(),
    OLLAMA_MODEL: z.string().min(1).optional(),
    OLLAMA_API_KEY: z.string().optional(),
    OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    VOICE_TRANSCRIBER_PROVIDER: voiceTranscriberProviderSchema.default("gemini"),
    VOICE_TRANSCRIBER_BASE_URL: z.string().url().optional(),
    VOICE_TRANSCRIBER_MODEL: z.string().min(1).optional(),
    VOICE_TRANSCRIBER_API_KEY: z.string().optional(),
    VOICE_TRANSCRIBER_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    VOICE_TRANSCRIBER_LANGUAGE: z.string().trim().min(2).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    JWT_EXPIRES_IN: z.string().min(1).default("7d"),
    ALLOWED_EMAILS: z
      .string()
      .transform((value) =>
        value
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      )
      .refine((emails) => emails.length > 0, {
        message: "ALLOWED_EMAILS debe incluir al menos un email"
      }),
    GOOGLE_DRIVE_ENABLED: optionalBooleanString,
    RCLONE_REMOTE: z.string().min(1).optional(),
    RCLONE_CONFIG_PATH: z.string().min(1).optional(),
    DAILY_REPORT_AUTOMATION_ENABLED: optionalBooleanString,
    DAILY_REPORT_AUTOMATION_HOUR: z.coerce.number().int().min(0).max(23).default(18),
    DAILY_REPORT_AUTOMATION_MINUTE: z.coerce.number().int().min(0).max(59).default(0),
    EMAIL_NOTIFICATIONS_ENABLED: booleanStringWithDefaultFalse,
    EMAIL_FROM: z.string().default(""),
    EMAIL_TO: z.string().default(""),
    EMAIL_APP_PASSWORD: z.string().default("")
  })
  .superRefine((value, context) => {
    const resolvedVoiceParserBaseUrl =
      value.VOICE_PARSER_BASE_URL ??
      value.OLLAMA_BASE_URL ??
      (value.VOICE_PARSER_PROVIDER === "ollama" ? "http://127.0.0.1:11434" : "https://api.openai.com/v1");
    const resolvedVoiceParserModel =
      value.VOICE_PARSER_MODEL ??
      value.OLLAMA_MODEL ??
      (value.VOICE_PARSER_PROVIDER === "ollama" ? "llama3.1:8b" : "gpt-4o-mini");
    const resolvedVoiceParserApiKey = value.VOICE_PARSER_API_KEY ?? value.OLLAMA_API_KEY ?? "";
    const resolvedVoiceParserTimeoutMs = value.VOICE_PARSER_TIMEOUT_MS ?? value.OLLAMA_TIMEOUT_MS ?? 15000;
    const resolvedVoiceTranscriberBaseUrl =
      value.VOICE_TRANSCRIBER_BASE_URL ??
      (value.VOICE_TRANSCRIBER_PROVIDER === "ollama"
        ? "https://ollama.com"
        : value.VOICE_TRANSCRIBER_PROVIDER === "gemini"
          ? "https://generativelanguage.googleapis.com/v1beta"
          : "https://api.openai.com/v1");
    const resolvedVoiceTranscriberModel =
      value.VOICE_TRANSCRIBER_MODEL ??
      (value.VOICE_TRANSCRIBER_PROVIDER === "ollama"
        ? "gemma4:e4b"
        : value.VOICE_TRANSCRIBER_PROVIDER === "gemini"
          ? "gemini-3.5-flash"
          : "gpt-4o-mini-transcribe");
    const resolvedVoiceTranscriberApiKey =
      value.VOICE_TRANSCRIBER_API_KEY ?? value.VOICE_PARSER_API_KEY ?? value.OLLAMA_API_KEY ?? "";
    const resolvedVoiceTranscriberTimeoutMs = value.VOICE_TRANSCRIBER_TIMEOUT_MS ?? 30000;
    const resolvedVoiceTranscriberLanguage = value.VOICE_TRANSCRIBER_LANGUAGE ?? "es";

    Object.assign(value, {
      VOICE_PARSER_API_KEY: resolvedVoiceParserApiKey,
      VOICE_PARSER_BASE_URL: resolvedVoiceParserBaseUrl,
      VOICE_PARSER_MODEL: resolvedVoiceParserModel,
      VOICE_PARSER_TIMEOUT_MS: resolvedVoiceParserTimeoutMs,
      VOICE_TRANSCRIBER_API_KEY: resolvedVoiceTranscriberApiKey,
      VOICE_TRANSCRIBER_BASE_URL: resolvedVoiceTranscriberBaseUrl,
      VOICE_TRANSCRIBER_MODEL: resolvedVoiceTranscriberModel,
      VOICE_TRANSCRIBER_TIMEOUT_MS: resolvedVoiceTranscriberTimeoutMs,
      VOICE_TRANSCRIBER_LANGUAGE: resolvedVoiceTranscriberLanguage
    });

    if (value.VOICE_PARSER_PROVIDER === "openai-compatible" && !resolvedVoiceParserApiKey.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "VOICE_PARSER_API_KEY es obligatorio cuando se usa openai-compatible",
        path: ["VOICE_PARSER_API_KEY"]
      });
    }

    if (!resolvedVoiceTranscriberApiKey.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "VOICE_TRANSCRIBER_API_KEY es obligatorio",
        path: ["VOICE_TRANSCRIBER_API_KEY"]
      });
    }

    if (value.GOOGLE_DRIVE_ENABLED) {
      const googleKeys = ["RCLONE_REMOTE", "RCLONE_CONFIG_PATH"] as const;

      googleKeys.forEach((key) => {
        if (value[key] === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} es obligatorio cuando se configura Google Drive con rclone`,
            path: [key]
          });
        }
      });
    }

    if (value.DAILY_REPORT_AUTOMATION_ENABLED && !value.GOOGLE_DRIVE_ENABLED) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_DRIVE_ENABLED debe ser true cuando se activa la automatizacion diaria",
        path: ["GOOGLE_DRIVE_ENABLED"]
      });
    }

    if (!value.EMAIL_NOTIFICATIONS_ENABLED) {
      return;
    }

    const emailKeys = ["EMAIL_FROM", "EMAIL_TO", "EMAIL_APP_PASSWORD"] as const;

    emailKeys.forEach((key) => {
      if (!value[key].trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} es obligatorio cuando se activa el envio de emails`,
          path: [key]
        });
      }
    });
  });

export const env = envSchema.parse(process.env);
