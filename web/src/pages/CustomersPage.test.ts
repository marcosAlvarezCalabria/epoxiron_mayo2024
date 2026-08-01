import { describe, expect, it } from "vitest";
import type { Customer } from "@/domain/entities";
import { customerToFormState, normalizeCustomerPayload } from "./CustomersPage";

const customer: Customer = {
  id: "customer-1",
  name: "Taller Norte",
  email: null,
  phone: null,
  address: null,
  notes: null,
  vat: "B12345678",
  legalName: "Taller Norte SL",
  fiscalStreet: "Calle Mayor 1",
  fiscalStreet2: "Nave 2",
  fiscalCity: "Madrid",
  fiscalZip: "28001",
  fiscalProvince: "Madrid",
  fiscalCountryCode: "ES",
  paymentTermCode: "30D",
  pricePerLinearMeter: 10,
  pricePerSquareMeter: 20,
  minimumRate: 5,
  grosorPrecio: null,
  specialPieces: []
};

describe("customer fiscal form mapping", () => {
  it("preserves and sends all editable fiscal fields", () => {
    const form = customerToFormState(customer);
    const payload = normalizeCustomerPayload(form);

    expect(payload).toMatchObject({
      vat: customer.vat,
      legalName: customer.legalName,
      fiscalStreet: customer.fiscalStreet,
      fiscalStreet2: customer.fiscalStreet2,
      fiscalCity: customer.fiscalCity,
      fiscalZip: customer.fiscalZip,
      fiscalProvince: customer.fiscalProvince,
      fiscalCountryCode: customer.fiscalCountryCode,
      paymentTermCode: customer.paymentTermCode
    });
    expect(payload).not.toHaveProperty("externalPartnerId");
  });

  it("defaults the country to ES for a historical customer", () => {
    const form = customerToFormState({
      ...customer,
      vat: undefined,
      fiscalCountryCode: undefined
    });

    expect(form.vat).toBe("");
    expect(form.fiscalCountryCode).toBe("ES");
  });
});
