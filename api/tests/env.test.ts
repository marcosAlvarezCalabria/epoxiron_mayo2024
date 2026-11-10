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

  it("configures Google Chirp 3 without requiring a Gemini API key", () => {
    const source: NodeJS.ProcessEnv = {
      ...process.env,
      VOICE_TRANSCRIBER_PROVIDER: "google-chirp",
      VOICE_TRANSCRIBER_API_KEY: "",
      GOOGLE_CLOUD_PROJECT: "epoxiron-staging",
      GOOGLE_CLOUD_LOCATION: "eu"
    };
    delete source.VOICE_TRANSCRIBER_MODEL;

    const result = parseEnv(source);

    expect(result.VOICE_TRANSCRIBER_MODEL).toBe("chirp_3");
    expect(result.GOOGLE_CLOUD_LOCATION).toBe("eu");
  });
});