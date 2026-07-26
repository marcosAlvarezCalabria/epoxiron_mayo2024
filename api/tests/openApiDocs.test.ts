import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const baseEnv = {
  DATABASE_URL: "postgresql://epoxiron:password@postgres:5432/epoxiron",
  PORT: "3001",
  CORS_ORIGIN: "http://localhost:5173",
  HERMES_BASE_URL: "http://hermes:8642",
  HERMES_SHARED_SECRET: "test-hermes-secret",
  HERMES_TIMEOUT_MS: "15000",
  GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
  JWT_SECRET: "test-jwt-secret",
  JWT_EXPIRES_IN: "7d",
  ALLOWED_EMAILS: "allowed@example.com",
  REPORT_UPLOADS_ENABLED: "false",
  DAILY_REPORT_AUTOMATION_ENABLED: "false",
  EMAIL_NOTIFICATIONS_ENABLED: "false",
  VOICE_TRANSCRIBER_API_KEY: "test-voice-api-key"
} as const;

const applyEnv = (nodeEnv: "test" | "production") => {
  Object.entries({
    ...baseEnv,
    NODE_ENV: nodeEnv
  }).forEach(([key, value]) => {
    process.env[key] = value;
  });
};

describe("OpenAPI docs", () => {
  let server: Server | null = null;

  beforeEach(() => {
    vi.resetModules();
    vi.mock("../src/infrastructure/repositories/PrismaCustomerRepository.js", () => ({
      PrismaCustomerRepository: class PrismaCustomerRepository {}
    }));
    vi.mock("../src/infrastructure/repositories/PrismaDeliveryNoteRepository.js", () => ({
      PrismaDeliveryNoteRepository: class PrismaDeliveryNoteRepository {}
    }));
    vi.mock("../src/infrastructure/repositories/PrismaDailyDeliveryNotesReportUploadRepository.js", () => ({
      PrismaDailyDeliveryNotesReportUploadRepository: class PrismaDailyDeliveryNotesReportUploadRepository {}
    }));
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    server = null;
    vi.restoreAllMocks();
  });

  it("serves a valid OpenAPI 3 document at /api/docs.json", async () => {
    applyEnv("test");
    const { createApp } = await import("../src/app.js");
    server = createApp().listen(0);

    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/docs.json`);
    const uiResponse = await fetch(`http://127.0.0.1:${address.port}/api/docs`);

    expect(response.status).toBe(200);
    expect(uiResponse.status).toBe(200);

    const body = await response.json() as {
      openapi?: string;
      paths?: Record<string, unknown>;
      components?: {
        schemas?: {
          CustomerInput?: {
            properties?: Record<string, unknown>;
          };
        };
      };
    };
    const html = await uiResponse.text();

    expect(body.openapi).toMatch(/^3\.0\.\d+$/);
    expect(body.paths).toHaveProperty("/api/auth/login/google");
    expect(body.paths).toHaveProperty("/api/hermes-tools/dashboard-summary");
    expect(body.paths).toHaveProperty("/api/invoices");
    expect(body.paths).toHaveProperty("/api/invoices/{id}/reconcile");
    expect(body.paths).toHaveProperty("/api/invoices/{id}/pdf");
    expect(body.components?.schemas?.CustomerInput?.properties).toHaveProperty("vat");
    expect(body.components?.schemas?.CustomerInput?.properties).toHaveProperty("fiscalCountryCode");
    expect(body.components?.schemas?.CustomerInput?.properties).not.toHaveProperty("externalPartnerId");
    expect(html).toContain("Swagger UI");
  }, 10_000);

  it("protects invoice creation and rejects client-supplied amounts or missing confirmation", async () => {
    applyEnv("test");
    const { createApp } = await import("../src/app.js");
    server = createApp().listen(0);
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/invoices`;
    const deliveryNoteId = "0d7f3b95-f00e-4e9d-a2b0-e6b78f654321";

    const unauthorized = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deliveryNoteIds: [deliveryNoteId], confirmed: true })
    });
    const suppliedAmount = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hermes-secret": baseEnv.HERMES_SHARED_SECRET
      },
      body: JSON.stringify({ deliveryNoteIds: [deliveryNoteId], confirmed: true, total: "1.00" })
    });
    const unconfirmed = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hermes-secret": baseEnv.HERMES_SHARED_SECRET
      },
      body: JSON.stringify({ deliveryNoteIds: [deliveryNoteId], confirmed: false })
    });

    expect(unauthorized.status).toBe(401);
    expect(suppliedAmount.status).toBe(400);
    expect(unconfirmed.status).toBe(400);
  }, 10_000);

  it("does not mount Swagger routes in production", async () => {
    applyEnv("production");
    const { createApp } = await import("../src/app.js");
    server = createApp().listen(0);

    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/docs`);

    expect(response.status).toBe(401);
  });
});
