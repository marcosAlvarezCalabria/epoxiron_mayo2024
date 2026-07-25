import { describe, expect, it } from "vitest";
import { customerInputSchema } from "../src/schemas/customerSchemas.js";

const validOperationalCustomer = {
  name: "Cliente",
  pricePerLinearMeter: 10,
  pricePerSquareMeter: 20,
  minimumRate: 5,
  specialPieces: []
};

describe("customerInputSchema fiscal data", () => {
  it("accepts a historical customer without fiscal data", () => {
    expect(customerInputSchema.safeParse(validOperationalCustomer).success).toBe(true);
  });

  it("accepts optional fiscal data", () => {
    const result = customerInputSchema.safeParse({
      ...validOperationalCustomer,
      vat: "B12345678",
      legalName: "Cliente SL",
      fiscalStreet: "Calle Mayor 1",
      fiscalStreet2: "Nave 2",
      fiscalCity: "Madrid",
      fiscalZip: "28001",
      fiscalProvince: "Madrid",
      fiscalCountryCode: "es",
      paymentTermCode: "30D"
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid fiscal country code", () => {
    const result = customerInputSchema.safeParse({
      ...validOperationalCustomer,
      fiscalCountryCode: "ESP"
    });

    expect(result.success).toBe(false);
  });

  it("does not accept an externally managed Odoo partner id", () => {
    const result = customerInputSchema.parse({
      ...validOperationalCustomer,
      externalPartnerId: "9"
    });

    expect("externalPartnerId" in result).toBe(false);
  });
});
