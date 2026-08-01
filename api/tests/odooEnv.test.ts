import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

const baseEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  ODOO_INVOICING_ENABLED: "false",
  ODOO_RECONCILIATION_ENABLED: "false",
  ODOO_URL: "",
  ODOO_DB: "",
  ODOO_USER: "",
  ODOO_API_KEY: ""
});

describe("Odoo environment configuration", () => {
  it("is disabled safely by default", () => {
    const result = parseEnv(baseEnv());
    expect(result.ODOO_INVOICING_ENABLED).toBe(false);
    expect(result.ODOO_RECONCILIATION_ENABLED).toBe(false);
  });

  it("requires all connection values when invoicing is enabled", () => {
    expect(() =>
      parseEnv({ ...baseEnv(), ODOO_INVOICING_ENABLED: "true" })
    ).toThrow();
  });

  it("does not allow reconciliation without invoicing", () => {
    expect(() =>
      parseEnv({ ...baseEnv(), ODOO_RECONCILIATION_ENABLED: "true" })
    ).toThrow();
  });
});
