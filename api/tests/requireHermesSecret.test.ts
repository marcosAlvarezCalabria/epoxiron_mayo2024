import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hermesSharedSecret = "test-hermes-secret";

const baseEnv = {
  DATABASE_URL: "postgresql://epoxiron:password@postgres:5432/epoxiron",
  PORT: "3001",
  NODE_ENV: "test",
  CORS_ORIGIN: "http://localhost:5173",
  HERMES_BASE_URL: "http://hermes:8642",
  HERMES_SHARED_SECRET: hermesSharedSecret,
  HERMES_TIMEOUT_MS: "15000",
  GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
  JWT_SECRET: "test-jwt-secret",
  JWT_EXPIRES_IN: "7d",
  ALLOWED_EMAILS: "allowed@example.com",
  REPORT_UPLOADS_ENABLED: "false"
} as const;

const buildRequest = (headers: Record<string, string | undefined>): Request =>
  ({
    header: (name: string) => headers[name.toLowerCase()]
  }) as Request;

const buildResponse = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn()
  } as unknown as Response;

  (response.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(response);
  return response;
};

describe("requireHermesSecret", () => {
  beforeEach(() => {
    Object.entries(baseEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["x-hermes-secret", hermesSharedSecret],
    ["x-epoxiron-hermes-secret", hermesSharedSecret]
  ])("accepts the supported %s header", async (headerName, secret) => {
    const { requireHermesSecret } = await import(
      "../src/middleware/requireHermesSecret.js"
    );
    const next = vi.fn() as NextFunction;
    const response = buildResponse();

    requireHermesSecret(buildRequest({ [headerName]: secret }), response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it.each(["wrong-hermes-token", "short"])(
    "rejects an invalid secret without exposing details",
    async (secret) => {
      const { requireHermesSecret } = await import(
        "../src/middleware/requireHermesSecret.js"
      );
      const next = vi.fn() as NextFunction;
      const response = buildResponse();

      requireHermesSecret(
        buildRequest({ "x-hermes-secret": secret }),
        response,
        next
      );

      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({ error: "No autorizado" });
      expect(next).not.toHaveBeenCalled();
    }
  );
});
