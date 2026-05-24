import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/env.js", () => ({
  env: {
    HERMES_BASE_URL: "http://localhost:8080",
    HERMES_SHARED_SECRET: "secret",
    HERMES_TIMEOUT_MS: 1000
  }
}));

import { HermesClient } from "../src/integrations/hermes/HermesClient.js";

describe("HermesClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the shared secret when creating sessions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "abc", createdAt: "2026-05-24T00:00:00.000Z" })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new HermesClient();
    const result = await client.createSession();

    expect(result.sessionId).toBe("abc");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/sessions", "http://localhost:8080"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-epoxiron-hermes-secret": "secret"
        })
      })
    );
  });
});

