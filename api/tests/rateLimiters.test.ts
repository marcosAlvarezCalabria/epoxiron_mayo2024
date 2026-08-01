import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildGeneralApiRateLimiter,
  buildLoginRateLimiter
} from "../src/middleware/rateLimiters.js";

const openServers: Server[] = [];

const startServer = async (app: express.Express): Promise<{ server: Server; baseUrl: string }> => {
  try {
    const server = await new Promise<Server>((resolve, reject) => {
      const candidate = app.listen(0, "127.0.0.1", () => resolve(candidate));
      candidate.once("error", reject);
    });
    openServers.push(server);
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("No se pudo obtener el puerto del servidor de pruebas");
    }

    return {
      server,
      baseUrl: `http://127.0.0.1:${address.port}`
    };
  } catch (error: unknown) {
    throw error;
  }
};

const closeServer = async (server: Server): Promise<void> => {
  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  } catch (error: unknown) {
    throw error;
  }
};

afterEach(async () => {
  try {
    await Promise.all(openServers.splice(0).map((server) => closeServer(server)));
  } catch (error: unknown) {
    throw error;
  }
});

describe("rate limiters", () => {
  it("allows API requests while the client remains under the general limit", async () => {
    try {
      const app = express();
      app.use(
        buildGeneralApiRateLimiter({
          windowMs: 60000,
          max: 2,
          hermesSharedSecret: "hermes-test-secret"
        })
      );
      app.get("/api/test", (_request, response) => response.sendStatus(204));
      const { baseUrl } = await startServer(app);

      const responses = await Promise.all([
        fetch(`${baseUrl}/api/test`),
        fetch(`${baseUrl}/api/test`)
      ]);

      expect(responses.map((response) => response.status)).toEqual([204, 204]);
    } catch (error: unknown) {
      throw error;
    }
  });

  it("returns a neutral 429 response when the login limit is exceeded", async () => {
    try {
      const app = express();
      app.use(buildLoginRateLimiter({ windowMs: 60000, max: 1 }));
      app.post("/api/auth/login/google", (_request, response) => response.sendStatus(204));
      const { baseUrl } = await startServer(app);

      const firstResponse = await fetch(`${baseUrl}/api/auth/login/google`, { method: "POST" });
      const blockedResponse = await fetch(`${baseUrl}/api/auth/login/google`, { method: "POST" });

      expect(firstResponse.status).toBe(204);
      expect(blockedResponse.status).toBe(429);
      await expect(blockedResponse.json()).resolves.toEqual({
        error: "Demasiadas solicitudes. Intentalo de nuevo mas tarde"
      });
    } catch (error: unknown) {
      throw error;
    }
  });

  it("does not count requests authenticated with the Hermes secret", async () => {
    try {
      const app = express();
      app.use(
        buildGeneralApiRateLimiter({
          windowMs: 60000,
          max: 1,
          hermesSharedSecret: "hermes-test-secret"
        })
      );
      app.get("/api/hermes-tools/test", (_request, response) => response.sendStatus(204));
      const { baseUrl } = await startServer(app);

      const statuses: number[] = [];
      for (let requestNumber = 0; requestNumber < 3; requestNumber += 1) {
        const response = await fetch(`${baseUrl}/api/hermes-tools/test`, {
          headers: {
            "x-hermes-secret": "hermes-test-secret"
          }
        });
        statuses.push(response.status);
      }

      expect(statuses).toEqual([204, 204, 204]);
    } catch (error: unknown) {
      throw error;
    }
  });

  it("does count requests that supply an invalid Hermes secret", async () => {
    try {
      const app = express();
      app.use(
        buildGeneralApiRateLimiter({
          windowMs: 60000,
          max: 1,
          hermesSharedSecret: "hermes-test-secret"
        })
      );
      app.get("/api/hermes-tools/test", (_request, response) => response.sendStatus(204));
      const { baseUrl } = await startServer(app);
      const headers = {
        "x-hermes-secret": "invalid-secret"
      };

      const firstResponse = await fetch(`${baseUrl}/api/hermes-tools/test`, { headers });
      const blockedResponse = await fetch(`${baseUrl}/api/hermes-tools/test`, { headers });

      expect(firstResponse.status).toBe(204);
      expect(blockedResponse.status).toBe(429);
    } catch (error: unknown) {
      throw error;
    }
  });
});
