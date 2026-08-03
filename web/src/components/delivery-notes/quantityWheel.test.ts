import { describe, expect, it } from "vitest";
import { quantityWheelScrollTop, resolveQuantityWheelScroll } from "./quantityWheel";

describe("quantity wheel", () => {
  it("keeps a new line quantity when the wheel reports the previous line position", () => {
    expect(
      resolveQuantityWheelScroll({
        currentQuantity: "1",
        isUserInitiated: false,
        itemHeight: 34,
        maximumQuantity: 200,
        scrollTop: 24 * 34
      })
    ).toBe("1");
  });

  it("keeps an edited line quantity during programmatic synchronization", () => {
    expect(
      resolveQuantityWheelScroll({
        currentQuantity: "4",
        isUserInitiated: false,
        itemHeight: 34,
        maximumQuantity: 200,
        scrollTop: 24 * 34
      })
    ).toBe("4");
  });

  it("updates the quantity when the user moves the wheel", () => {
    expect(
      resolveQuantityWheelScroll({
        currentQuantity: "4",
        isUserInitiated: true,
        itemHeight: 34,
        maximumQuantity: 200,
        scrollTop: 24 * 34
      })
    ).toBe("25");
  });

  it("calculates the wheel position for the active line", () => {
    expect(quantityWheelScrollTop("25", 34, 200)).toBe(24 * 34);
  });
});
