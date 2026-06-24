import { describe, expect, it } from "vitest";
import { deliveryNoteItemDraftSchema } from "../src/schemas/deliveryNoteSchemas.js";

const middleDot = "\u00B7";

describe("deliveryNoteItemDraftSchema", () => {
  it("normalizes manual descriptions to uppercase and removes trailing unidad", () => {
    const result = deliveryNoteItemDraftSchema.parse({
      description: `papelera 510x510x2+510x1120x4 ${middleDot} ral 9003 ${middleDot} unidad`,
      color: "RAL 9003",
      pricingMode: "UNIT",
      quantity: 1
    });

    expect(result.description).toBe(`PAPELERA 510X510X2+510X1120X4 ${middleDot} RAL 9003`);
  });
});
