import { describe, expect, it } from "vitest";
import {
  formatMillimeterDimensions,
  parseSquareMetersFromMillimeters,
  squareMetersFromMillimeters
} from "@/lib/measurements";

describe("millimeter measurements", () => {
  it("converts width and height in millimeters to square meters", () => {
    expect(squareMetersFromMillimeters(2500, 800)).toBe(2);
    expect(parseSquareMetersFromMillimeters("2500", "800")).toBe(2);
  });

  it("requires both positive dimensions", () => {
    expect(squareMetersFromMillimeters(2500, null)).toBeNull();
    expect(squareMetersFromMillimeters(0, 800)).toBeNull();
  });

  it("formats dimensions for delivery notes in millimeters", () => {
    expect(formatMillimeterDimensions(2500, 800)).toBe("2500 x 800 mm");
  });
});