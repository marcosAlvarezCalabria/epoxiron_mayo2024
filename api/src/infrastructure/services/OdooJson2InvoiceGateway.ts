import type {
  FiscalCustomerSnapshot,
  OdooMoveState,
  VerifactuState
} from "../../domain/entities/Invoice.js";
import type {
  ExternalPartnerRef,
  InvoiceGateway,
  RemoteInvoice,
  RemoteInvoiceDraft,
  RemoteInvoiceStatus
} from "../../domain/ports/InvoiceGateway.js";
import { canonicalDecimal } from "../../domain/services/invoiceMoney.js";

type OdooPrimitive = string | number | boolean | null;
type OdooValue = OdooPrimitive | OdooValue[] | { [key: string]: OdooValue };
type OdooRecord = { id: number; [key: string]: OdooValue };

export class OdooGatewayError extends Error {
  public constructor(public readonly code: string) {
    super("La operación de facturación externa no pudo completarse");
    this.name = "OdooGatewayError";
  }
}

const numericId = (value: unknown, code: string): number => {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "number" || !Number.isInteger(candidate) || candidate <= 0) {
    throw new OdooGatewayError(code);
  }
  return candidate;
};

const text = (value: OdooValue | undefined): string | null =>
  typeof value === "string" && value.trim() ? value : null;
const decimal = (value: OdooValue | undefined): string => {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new OdooGatewayError("ODOO_INVALID_AMOUNT");
  }
  return canonicalDecimal(String(value), 2);
};
const moveState = (value: OdooValue | undefined): OdooMoveState => {
  if (value === "draft") return "DRAFT";
  if (value === "posted") return "POSTED";
  if (value === "cancel") return "CANCEL";
  throw new OdooGatewayError("ODOO_INVALID_MOVE_STATE");
};
const verifactuState = (value: OdooValue | undefined): VerifactuState => {
  if (value === "accepted") return "ACCEPTED";
  if (value === "rejected" || value === "error") return "REJECTED";
  if (value === "pending" || value === "processing") return "PENDING";
  return "NOT_SENT";
};

export interface OdooJson2Config {
  url: string;
  database: string;
  apiKey: string;
  timeoutMs: number;
  taxRate: string;
  maxPdfBytes: number;
}

export class OdooJson2InvoiceGateway implements InvoiceGateway {
  private taxId: number | null = null;
  private companyId: number | null = null;

  public constructor(private readonly config: OdooJson2Config) {}

  private async call<T>(model: string, method: string, payload: Record<string, OdooValue>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(
        `${this.config.url.replace(/\/+$/, "")}/json/2/${encodeURIComponent(model)}/${encodeURIComponent(method)}`,
        {
          method: "POST",
          headers: {
            Authorization: `bearer ${this.config.apiKey}`,
            "Content-Type": "application/json; charset=utf-8",
            "X-Odoo-Database": this.config.database
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );
      if (!response.ok) throw new OdooGatewayError(`ODOO_HTTP_${response.status}`);
      return (await response.json()) as T;
    } catch (error: unknown) {
      if (error instanceof OdooGatewayError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new OdooGatewayError("ODOO_TIMEOUT");
      }
      throw new OdooGatewayError("ODOO_NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async create(model: string, values: Record<string, OdooValue>): Promise<number> {
    const result = await this.call<number | number[]>(model, "create", { vals_list: [values] });
    return numericId(result, "ODOO_INVALID_CREATE_RESULT");
  }

  private async resolveSingle(
    model: string,
    domain: OdooValue[],
    fields: string[],
    code: string
  ): Promise<OdooRecord | null> {
    const records = await this.call<OdooRecord[]>(model, "search_read", {
      domain,
      fields,
      limit: 2
    });
    if (records.length > 1) throw new OdooGatewayError(`${code}_AMBIGUOUS`);
    return records[0] ?? null;
  }

  public async ensureCustomer(input: FiscalCustomerSnapshot): Promise<ExternalPartnerRef> {
    let partner: OdooRecord | null = null;
    if (input.externalPartnerId) {
      const id = Number(input.externalPartnerId);
      if (Number.isInteger(id) && id > 0) {
        const records = await this.call<OdooRecord[]>("res.partner", "read", {
          ids: [id],
          fields: ["id"]
        });
        partner = records[0] ?? null;
      }
    }
    partner ??= await this.resolveSingle(
      "res.partner",
      [["vat", "=", input.vat]],
      ["id"],
      "ODOO_PARTNER"
    );

    const country = await this.resolveSingle(
      "res.country",
      [["code", "=", input.countryCode]],
      ["id"],
      "ODOO_COUNTRY"
    );
    if (!country) throw new OdooGatewayError("ODOO_COUNTRY_NOT_FOUND");

    const values: Record<string, OdooValue> = {
      name: input.legalName,
      vat: input.vat,
      street: input.street,
      street2: input.street2 ?? false,
      city: input.city,
      zip: input.zip,
      country_id: country.id,
      is_company: true,
      customer_rank: 1
    };
    if (input.province) {
      const province = await this.resolveSingle(
        "res.country.state",
        [["name", "ilike", input.province], ["country_id", "=", country.id]],
        ["id"],
        "ODOO_PROVINCE"
      );
      if (province) values.state_id = province.id;
    }
    if (input.paymentTermCode) {
      const term = await this.resolveSingle(
        "account.payment.term",
        [["name", "ilike", input.paymentTermCode]],
        ["id"],
        "ODOO_PAYMENT_TERM"
      );
      if (!term) throw new OdooGatewayError("ODOO_PAYMENT_TERM_NOT_FOUND");
      values.property_payment_term_id = term.id;
    }

    if (partner) {
      await this.call<boolean>("res.partner", "write", { ids: [partner.id], vals: values });
      return { id: String(partner.id) };
    }
    return { id: String(await this.create("res.partner", values)) };
  }

  private async resolveTaxId(): Promise<number> {
    if (this.taxId) return this.taxId;
    if (!this.companyId) {
      const context = await this.call<Record<string, OdooValue>>("res.users", "context_get", {});
      const allowedCompanies = context.allowed_company_ids;
      if (!Array.isArray(allowedCompanies) || typeof allowedCompanies[0] !== "number") {
        throw new OdooGatewayError("ODOO_COMPANY_NOT_FOUND");
      }
      this.companyId = allowedCompanies[0];
    }
    const tax = await this.resolveSingle(
      "account.tax",
      [
        ["type_tax_use", "=", "sale"],
        ["amount", "=", Number(this.config.taxRate)],
        ["active", "=", true],
        ["company_id", "=", this.companyId]
      ],
      ["id"],
      "ODOO_TAX"
    );
    if (!tax) throw new OdooGatewayError("ODOO_TAX_NOT_FOUND");
    this.taxId = tax.id;
    return tax.id;
  }

  private recordToRemote(record: OdooRecord): RemoteInvoice {
    return {
      id: String(record.id),
      number: text(record.name),
      moveState: moveState(record.state),
      subtotal: decimal(record.amount_untaxed),
      taxAmount: decimal(record.amount_tax),
      total: decimal(record.amount_total)
    };
  }

  private async readInvoice(id: string): Promise<OdooRecord> {
    const records = await this.call<OdooRecord[]>("account.move", "read", {
      ids: [numericId(Number(id), "ODOO_INVALID_INVOICE_ID")],
      fields: [
        "name",
        "state",
        "amount_untaxed",
        "amount_tax",
        "amount_total",
        "l10n_es_edi_verifactu_state",
        "l10n_es_edi_verifactu_document_ids",
        "l10n_es_edi_verifactu_qr_code",
        "invoice_pdf_report_file"
      ]
    });
    if (!records[0]) throw new OdooGatewayError("ODOO_INVOICE_NOT_FOUND");
    return records[0];
  }

  public async findInvoiceByReference(reference: string) {
    const record = await this.resolveSingle(
      "account.move",
      [["move_type", "=", "out_invoice"], ["ref", "=", reference]],
      ["id", "name", "state", "amount_untaxed", "amount_tax", "amount_total"],
      "ODOO_INVOICE_REFERENCE"
    );
    return record ? this.recordToRemote(record) : null;
  }

  public async createDraftInvoice(input: RemoteInvoiceDraft) {
    const taxId = await this.resolveTaxId();
    const id = await this.create("account.move", {
      move_type: "out_invoice",
      partner_id: numericId(Number(input.customerId), "ODOO_INVALID_PARTNER_ID"),
      ref: input.reference,
      invoice_line_ids: input.lines.map((line) => [
        0,
        0,
        {
          name: line.description,
          quantity: Number(line.quantity),
          price_unit: Number(line.unitPrice),
          tax_ids: [[6, 0, [taxId]]]
        }
      ])
    });
    return this.recordToRemote(await this.readInvoice(String(id)));
  }

  public async postInvoice(externalInvoiceId: string) {
    await this.call("account.move", "action_post", {
      ids: [numericId(Number(externalInvoiceId), "ODOO_INVALID_INVOICE_ID")]
    });
    return this.recordToRemote(await this.readInvoice(externalInvoiceId));
  }

  public async sendInvoice(externalInvoiceId: string): Promise<void> {
    const id = numericId(Number(externalInvoiceId), "ODOO_INVALID_INVOICE_ID");
    const wizardId = await this.create("account.move.send.wizard", {
      move_id: id,
      sending_methods: []
    });
    await this.call("account.move.send.wizard", "action_send_and_print", {
      ids: [wizardId],
      context: { active_model: "account.move", active_id: id, active_ids: [id] }
    });
  }

  public async getInvoice(externalInvoiceId: string): Promise<RemoteInvoiceStatus> {
    const record = await this.readInvoice(externalInvoiceId);
    const state = verifactuState(record.l10n_es_edi_verifactu_state);
    const documentIds = record.l10n_es_edi_verifactu_document_ids;
    const documentId =
      Array.isArray(documentIds) && typeof documentIds[0] === "number"
        ? String(documentIds[0])
        : null;
    return {
      ...this.recordToRemote(record),
      verifactuState: state,
      verifactuDocumentId: documentId,
      qrValue: text(record.l10n_es_edi_verifactu_qr_code),
      rejectionReason: state === "REJECTED" ? "VeriFactu rechazó la factura" : null,
      pdfAvailable: typeof record.invoice_pdf_report_file === "string"
    };
  }

  public async fetchInvoicePdf(externalInvoiceId: string): Promise<Buffer> {
    const record = await this.readInvoice(externalInvoiceId);
    const encoded = text(record.invoice_pdf_report_file);
    if (!encoded) throw new OdooGatewayError("ODOO_PDF_NOT_AVAILABLE");
    const pdf = Buffer.from(encoded, "base64");
    if (pdf.length > this.config.maxPdfBytes) throw new OdooGatewayError("ODOO_PDF_TOO_LARGE");
    if (pdf.subarray(0, 4).toString("ascii") !== "%PDF") {
      throw new OdooGatewayError("ODOO_INVALID_PDF");
    }
    return pdf;
  }
}
