import { describe, expect, it } from "vitest";
import {
  calculateInvoiceAmounts,
  canonicalDecimal,
  unitPriceFromSubtotal
} from "../src/domain/services/invoiceMoney.js";

describe("invoice money", () => {
  it("rounds globally instead of summing per-line tax", () => {
    expect(calculateInvoiceAmounts(["0.01", "0.01", "0.01"], "21")).toEqual({
      subtotal: "0.03",
      taxAmount: "0.01",
      total: "0.04"
    });
  });

  it("supports precise four-decimal quantities and prices", () => {
    expect(canonicalDecimal("1.23456", 4)).toBe("1.2346");
    expect(canonicalDecimal("999999999.995", 2)).toBe("1000000000.00");
    expect(unitPriceFromSubtotal("10.00", 3)).toBe("3.3333");
  });

  it("handles zero and the minimum cent", () => {
    expect(calculateInvoiceAmounts(["0.00"], "21")).toEqual({
      subtotal: "0.00",
      taxAmount: "0.00",
      total: "0.00"
    });
    expect(calculateInvoiceAmounts(["0.01"], "21").total).toBe("0.01");
  });
});
