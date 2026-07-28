import { describe, expect, it } from "vitest";
import {
  normalizeCommercialText,
  normalizeOptionalCommercialText
} from "../src/domain/services/commercialText.js";

describe("commercial text normalization", () => {
  it("normalizes Spanish commercial text without losing accents", () => {
    expect(normalizeCommercialText("  Peña y Muñoz, S.L.  ")).toBe("PEÑA Y MUÑOZ, S.L.");
  });

  it("keeps optional blank values as null", () => {
    expect(normalizeOptionalCommercialText("   ")).toBeNull();
  });
});
