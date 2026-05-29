import { describe, expect, it } from "vitest";
import { getDateQuery } from "../src/controllers/requestParsers.js";

describe("request parsers", () => {
  it("parses yyyy-mm-dd dates without timezone drift", () => {
    const parsed = getDateQuery("2026-05-29");

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(4);
    expect(parsed?.getDate()).toBe(29);
  });

  it("returns undefined for impossible calendar dates", () => {
    expect(getDateQuery("2026-02-31")).toBeUndefined();
  });
});
