import { describe, expect, it } from "vitest";

import { resolveApiUrl } from "@/config/api";

describe("resolveApiUrl", () => {
  it("uses the configured API URL", () => {
    expect(resolveApiUrl("https://api.example.com/", false)).toBe(
      "https://api.example.com"
    );
  });

  it("uses localhost only during development", () => {
    expect(resolveApiUrl(undefined, true)).toBe("http://localhost:3001");
  });

  it("fails safe to the public API in production", () => {
    expect(resolveApiUrl(undefined, false)).toBe(
      "https://api.wwwmarcos-alvarez.com"
    );
  });
});
