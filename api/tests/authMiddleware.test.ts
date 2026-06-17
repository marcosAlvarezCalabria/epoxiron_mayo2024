import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JwtAccessTokenIssuer } from "../src/infrastructure/services/JwtAccessTokenIssuer.js";

const baseEnv = {
  DATABASE_URL: "postgresql://epoxiron:password@postgres:5432/epoxiron",
  PORT: "3001",
  NODE_ENV: "test",
  CORS_ORIGIN: "http://localhost:5173",
  HERMES_BASE_URL: "http://hermes:8642",
  HERMES_SHARED_SECRET: "test-hermes-secret",
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

describe("authMiddleware", () => {
  beforeEach(() => {
    Object.entries(baseEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows requests signed with the Hermes secret", async () => {
    const { authMiddleware } = await import("../src/middleware/authMiddleware.js");
    const next = vi.fn() as NextFunction;
    const response = buildResponse();

    authMiddleware(
      buildRequest({
        "x-hermes-secret": baseEnv.HERMES_SHARED_SECRET
      }),
      response,
      next
    );

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("rejects requests without a bearer token", async () => {
    const { authMiddleware } = await import("../src/middleware/authMiddleware.js");
    const next = vi.fn() as NextFunction;
    const response = buildResponse();

    authMiddleware(buildRequest({}), response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "No autorizado" });
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a valid bearer token", async () => {
    const { authMiddleware } = await import("../src/middleware/authMiddleware.js");
    const next = vi.fn() as NextFunction;
    const response = buildResponse();
    const token = new JwtAccessTokenIssuer(
      baseEnv.JWT_SECRET,
      baseEnv.JWT_EXPIRES_IN
    ).issue({
      email: "allowed@example.com",
      name: "Allowed User"
    });

    authMiddleware(
      buildRequest({
        authorization: `Bearer ${token}`
      }),
      response,
      next
    );

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });
});
