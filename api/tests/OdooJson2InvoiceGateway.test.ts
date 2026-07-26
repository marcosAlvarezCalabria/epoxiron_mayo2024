import { afterEach, describe, expect, it, vi } from "vitest";
import { OdooJson2InvoiceGateway } from "../src/infrastructure/services/OdooJson2InvoiceGateway.js";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const config = {
  url: "https://odoo.example.test",
  database: "test-db",
  apiKey: "secret-for-test",
  timeoutMs: 1000,
  taxRate: "21",
  maxPdfBytes: 1024
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OdooJson2InvoiceGateway", () => {
  it("uses vals_list and the required headers when creating a draft", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ uid: 2 }))
      .mockResolvedValueOnce(jsonResponse([{ id: 2, company_id: [1, "Test Company"] }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 5 }]))
      .mockResolvedValueOnce(jsonResponse([101]))
      .mockResolvedValueOnce(jsonResponse([{
        id: 101,
        name: false,
        state: "draft",
        amount_untaxed: 10,
        amount_tax: 2.1,
        amount_total: 12.1
      }]));
    vi.stubGlobal("fetch", fetchMock);
    const gateway = new OdooJson2InvoiceGateway(config);

    await gateway.createDraftInvoice({
      customerId: "9",
      reference: "EPOX-abc",
      lines: [{
        description: "ALB-1 · Pieza",
        quantity: "1.0000",
        unitPrice: "10.0000",
        subtotal: "10.00",
        taxRate: "21.00",
        position: 0
      }]
    });

    const userRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const taxRequest = fetchMock.mock.calls[2]?.[1] as RequestInit;
    const createRequest = fetchMock.mock.calls[3]?.[1] as RequestInit;
    expect(JSON.parse(String(userRequest.body))).toEqual({
      ids: [2],
      fields: ["company_id"]
    });
    expect((taxRequest.headers as Record<string, string>).Authorization).toBe("bearer secret-for-test");
    expect((taxRequest.headers as Record<string, string>)["X-Odoo-Database"]).toBe("test-db");
    expect(JSON.parse(String(createRequest.body))).toMatchObject({
      vals_list: [{
        move_type: "out_invoice",
        partner_id: 9,
        ref: "EPOX-abc"
      }]
    });
  });

  it("creates the send wizard with email methods disabled", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(77))
      .mockResolvedValueOnce(jsonResponse(true));
    vi.stubGlobal("fetch", fetchMock);
    const gateway = new OdooJson2InvoiceGateway(config);

    await gateway.sendInvoice("101");

    const wizardRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(wizardRequest.body))).toEqual({
      vals_list: [{ move_id: 101, sending_methods: [] }]
    });
  });

  it("does not update a cached partner whose VAT belongs to someone else", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 9, vat: "B99999999" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 10 }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 34 }]))
      .mockResolvedValueOnce(jsonResponse(true));
    vi.stubGlobal("fetch", fetchMock);
    const gateway = new OdooJson2InvoiceGateway(config);

    const result = await gateway.ensureCustomer({
      customerId: "customer-1",
      legalName: "Cliente SL",
      vat: "B12345678",
      street: "Calle Mayor 1",
      street2: null,
      city: "Madrid",
      zip: "28001",
      province: null,
      countryCode: "ES",
      paymentTermCode: null,
      externalPartnerId: "9"
    });

    const writeRequest = fetchMock.mock.calls[3]?.[1] as RequestInit;
    expect(result.id).toBe("10");
    expect(JSON.parse(String(writeRequest.body))).toMatchObject({ ids: [10] });
  });

  it("validates PDF signature and size", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([{
          id: 101,
          name: "INV/1",
          state: "posted",
          amount_untaxed: 10,
          amount_tax: 2.1,
          amount_total: 12.1,
          invoice_pdf_report_file: Buffer.from("%PDF-test").toString("base64")
        }])
      )
    );
    const gateway = new OdooJson2InvoiceGateway(config);

    await expect(gateway.fetchInvoicePdf("101")).resolves.toEqual(Buffer.from("%PDF-test"));
  });

  it("sanitizes remote HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ secret: "do not expose" }, 500)));
    const gateway = new OdooJson2InvoiceGateway(config);

    await expect(gateway.findInvoiceByReference("EPOX-abc")).rejects.toMatchObject({
      name: "ODOO_HTTP_500",
      code: "ODOO_HTTP_500",
      message: "La operación de facturación externa no pudo completarse"
    });
  });
});
