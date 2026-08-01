import { afterEach, describe, expect, it } from "vitest";

import { getConfig } from "../src/config.js";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("getConfig", () => {
  it("valida los secretos requeridos", () => {
    process.env.ODOO_URL = "no-es-url";
    process.env.ODOO_DB = "";
    process.env.ODOO_USER = "";
    process.env.ODOO_API_KEY = "";
    expect(() => getConfig()).toThrow();
  });

  it("normaliza URL, partner y bandera de escritura", () => {
    process.env.ODOO_URL = "https://odoo.example.com/";
    process.env.ODOO_DB = "staging";
    process.env.ODOO_USER = "technical@example.com";
    process.env.ODOO_API_KEY = "secret";
    process.env.ODOO_TEST_PARTNER_ID = "42";
    process.env.SPIKE_ALLOW_WRITES = "false";
    const value = getConfig();
    expect(value.ODOO_URL).toBe("https://odoo.example.com");
    expect(value.ODOO_TEST_PARTNER_ID).toBe(42);
    expect(value.SPIKE_ALLOW_WRITES).toBe(false);
  });
});

