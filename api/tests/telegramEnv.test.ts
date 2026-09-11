import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

const baseEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  EPOXIRON_TELEGRAM_BOT_ENABLED: "false",
  EPOXIRON_TELEGRAM_WRITES_ENABLED: "false",
  EPOXIRON_TELEGRAM_BOT_ENVIRONMENT: "disabled",
  EPOXIRON_TELEGRAM_BOT_TOKEN: "",
  EPOXIRON_TELEGRAM_ALLOWED_USER_IDS: ""
});

describe("Telegram environment configuration", () => {
  it("keeps the bot and writes disabled by default", () => {
    const result = parseEnv(baseEnv());

    expect(result.EPOXIRON_TELEGRAM_BOT_ENABLED).toBe(false);
    expect(result.EPOXIRON_TELEGRAM_WRITES_ENABLED).toBe(false);
  });

  it("refuses to enable the bot without an explicit environment", () => {
    expect(() =>
      parseEnv({
        ...baseEnv(),
        EPOXIRON_TELEGRAM_BOT_ENABLED: "true",
        EPOXIRON_TELEGRAM_BOT_TOKEN: "test-token",
        EPOXIRON_TELEGRAM_ALLOWED_USER_IDS: "123"
      })
    ).toThrow();
  });

  it("accepts an isolated staging bot while writes remain disabled", () => {
    const result = parseEnv({
      ...baseEnv(),
      EPOXIRON_TELEGRAM_BOT_ENABLED: "true",
      EPOXIRON_TELEGRAM_BOT_ENVIRONMENT: "staging",
      EPOXIRON_TELEGRAM_BOT_TOKEN: "test-token",
      EPOXIRON_TELEGRAM_ALLOWED_USER_IDS: "123, 456"
    });

    expect(result.EPOXIRON_TELEGRAM_ALLOWED_USER_IDS).toEqual(["123", "456"]);
    expect(result.EPOXIRON_TELEGRAM_WRITES_ENABLED).toBe(false);
  });

  it("accepts an explicitly configured production bot", () => {
    const result = parseEnv({
      ...baseEnv(),
      EPOXIRON_TELEGRAM_BOT_ENABLED: "true",
      EPOXIRON_TELEGRAM_WRITES_ENABLED: "true",
      EPOXIRON_TELEGRAM_BOT_ENVIRONMENT: "production",
      EPOXIRON_TELEGRAM_BOT_TOKEN: "production-token",
      EPOXIRON_TELEGRAM_ALLOWED_USER_IDS: "123"
    });

    expect(result.EPOXIRON_TELEGRAM_BOT_ENVIRONMENT).toBe("production");
    expect(result.EPOXIRON_TELEGRAM_WRITES_ENABLED).toBe(true);
  });
});
