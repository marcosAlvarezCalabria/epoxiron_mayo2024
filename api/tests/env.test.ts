import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

describe("environment defaults", () => {
  it("limits JWT lifetime to one day by default", () => {
    const source: NodeJS.ProcessEnv = {
      ...process.env
    };
    delete source.JWT_EXPIRES_IN;

    const result = parseEnv(source);

    expect(result.JWT_EXPIRES_IN).toBe("1d");
  });
});
