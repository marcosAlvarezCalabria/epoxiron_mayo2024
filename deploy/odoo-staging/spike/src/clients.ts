import xmlrpc from "xmlrpc";

import type { SpikeConfig } from "./config.js";

export type OdooValue =
  | string
  | number
  | boolean
  | null
  | OdooValue[]
  | { [key: string]: OdooValue };

export interface OdooRecord {
  id: number;
  [key: string]: OdooValue;
}

export interface OdooClient {
  authenticate(): Promise<{ userId: number | null; version: string }>;
  call<T>(model: string, method: string, kwargs: Record<string, OdooValue>): Promise<T>;
}

export class Json2Client implements OdooClient {
  public constructor(private readonly config: SpikeConfig) {}

  public async authenticate(): Promise<{ userId: number | null; version: string }> {
    const versionResponse = await fetch(`${this.config.ODOO_URL}/web/webclient/version_info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {},
        id: crypto.randomUUID()
      })
    });
    if (!versionResponse.ok) {
      throw new Error(`No se pudo leer la versión: HTTP ${versionResponse.status}`);
    }
    const versionEnvelope = (await versionResponse.json()) as {
      result?: { server_version?: unknown };
      error?: { message?: unknown };
    };
    if (!versionEnvelope.result) {
      const reason =
        typeof versionEnvelope.error?.message === "string"
          ? versionEnvelope.error.message
          : "respuesta sin resultado";
      throw new Error(`No se pudo leer la versión: ${reason}`);
    }
    const context = await this.call<Record<string, OdooValue>>("res.users", "context_get", {});
    return {
      userId: typeof context.uid === "number" ? context.uid : null,
      version:
        typeof versionEnvelope.result.server_version === "string"
          ? versionEnvelope.result.server_version
          : "unknown"
    };
  }

  public async call<T>(
    model: string,
    method: string,
    kwargs: Record<string, OdooValue>
  ): Promise<T> {
    const response = await fetch(
      `${this.config.ODOO_URL}/json/2/${encodeURIComponent(model)}/${encodeURIComponent(method)}`,
      {
        method: "POST",
        headers: {
          Authorization: `bearer ${this.config.ODOO_API_KEY}`,
          "Content-Type": "application/json; charset=utf-8",
          "X-Odoo-Database": this.config.ODOO_DB
        },
        body: JSON.stringify(kwargs)
      }
    );
    const body = (await response.json()) as T | { message?: unknown; name?: unknown };
    if (!response.ok) {
      const error = body as { message?: unknown; name?: unknown };
      throw new Error(
        `${typeof error.name === "string" ? error.name : "Odoo JSON-2"}: ${
          typeof error.message === "string" ? error.message : `HTTP ${response.status}`
        }`
      );
    }
    return body as T;
  }
}

type RpcClient = ReturnType<typeof xmlrpc.createClient>;

const rpcClient = (url: string): RpcClient => {
  const parsed = new URL(url);
  const options = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80,
    path: parsed.pathname
  };
  return parsed.protocol === "https:"
    ? xmlrpc.createSecureClient(options)
    : xmlrpc.createClient(options);
};

const rpcCall = async <T>(
  client: RpcClient,
  method: string,
  parameters: unknown[]
): Promise<T> =>
  new Promise<T>((resolvePromise, reject) => {
    client.methodCall(method, parameters, (error, value: T) => {
      if (error) {
        const message =
          typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
            ? error.message
            : String(error);
        reject(new Error(`XML-RPC ${method}: ${message}`));
        return;
      }
      resolvePromise(value);
    });
  });

export class XmlRpcClient implements OdooClient {
  private userId: number | null = null;

  public constructor(private readonly config: SpikeConfig) {}

  public async authenticate(): Promise<{ userId: number; version: string }> {
    const common = rpcClient(`${this.config.ODOO_URL}/xmlrpc/2/common`);
    const version = await rpcCall<{ server_version?: unknown }>(common, "version", []);
    const userId = await rpcCall<number | false>(common, "authenticate", [
      this.config.ODOO_DB,
      this.config.ODOO_USER,
      this.config.ODOO_API_KEY,
      {}
    ]);
    if (userId === false) {
      throw new Error("Odoo rechazó la autenticación XML-RPC");
    }
    this.userId = userId;
    return {
      userId,
      version: typeof version.server_version === "string" ? version.server_version : "unknown"
    };
  }

  public async call<T>(
    model: string,
    method: string,
    kwargs: Record<string, OdooValue>
  ): Promise<T> {
    if (this.userId === null) {
      throw new Error("XML-RPC requiere authenticate() antes de call()");
    }
    const args = Array.isArray(kwargs.args)
      ? kwargs.args
      : Array.isArray(kwargs.ids)
        ? [kwargs.ids]
        : [];
    const filtered = Object.fromEntries(
      Object.entries(kwargs).filter(([key]) => key !== "ids" && key !== "args")
    );
    return rpcCall<T>(
      rpcClient(`${this.config.ODOO_URL}/xmlrpc/2/object`),
      "execute_kw",
      [
        this.config.ODOO_DB,
        this.userId,
        this.config.ODOO_API_KEY,
        model,
        method,
        args,
        filtered
      ]
    );
  }
}
