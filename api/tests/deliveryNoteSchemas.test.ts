import { describe, expect, it } from "vitest";
import { deliveryNoteItemDraftSchema } from "../src/schemas/deliveryNoteSchemas.js";

const middleDot = "\u00B7";

describe("deliveryNoteItemDraftSchema", () => {
  it("normalizes manual descriptions removing ral and unidad from line text", () => {
    const result = deliveryNoteItemDraftSchema.parse({
      description: `papelera 510x510x2+510x1120x4 ${middleDot} ral 9003 ${middleDot} unidad`,
      color: "RAL 9003",
      pricingMode: "UNIT",
      quantity: 1
    });

    expect(result.description).toBe(`PAPELERA 510X510X2+510X1120X4 ${middleDot} 9003`);
  });

  it("accepts quantities from 1 to 1000 and rejects values outside the shared range", () => {
    const base = {
      description: "Pieza",
      color: "RAL 9003",
      pricingMode: "UNIT" as const
    };

    expect(deliveryNoteItemDraftSchema.safeParse({ ...base, quantity: 1 }).success).toBe(true);
    expect(deliveryNoteItemDraftSchema.safeParse({ ...base, quantity: 1000 }).success).toBe(true);
    expect(deliveryNoteItemDraftSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(deliveryNoteItemDraftSchema.safeParse({ ...base, quantity: 1001 }).success).toBe(false);
  });

  it("converts paired millimeter dimensions into square meters", () => {
    const result = deliveryNoteItemDraftSchema.parse({
      description: "Chapa",
      color: "ORO",
      pricingMode: "DIMENSIONS",
      quantity: 1,
      widthMm: 2500,
      heightMm: 800
    });

    expect(result.squareMeters).toBe(2);
    expect(result.widthMm).toBe(2500);
    expect(result.heightMm).toBe(800);
  });

  it("rejects incomplete millimeter dimensions", () => {
    expect(deliveryNoteItemDraftSchema.safeParse({
      description: "Chapa",
      color: "ORO",
      pricingMode: "DIMENSIONS",
      quantity: 1,
      widthMm: 2500
    }).success).toBe(false);
  });
});
