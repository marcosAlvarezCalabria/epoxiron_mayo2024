import type { Invoice } from "../../../domain/entities/Invoice.js";
import { DomainException } from "../../../domain/exceptions/DomainException.js";
import type { InvoiceGateway } from "../../../domain/ports/InvoiceGateway.js";
import type { InvoiceRepository } from "../../../domain/repositories/InvoiceRepository.js";
import { buildInvoiceKeys } from "./invoiceKeys.js";

interface SanitizedExternalError {
  code: string;
  message: string;
  recoverable: boolean;
}

const permanentCustomerErrorCodes = new Set([
  "ODOO_HTTP_400",
  "ODOO_HTTP_422",
  "ODOO_COUNTRY_NOT_FOUND",
  "ODOO_PROVINCE_AMBIGUOUS",
  "ODOO_PAYMENT_TERM_NOT_FOUND",
  "ODOO_PAYMENT_TERM_AMBIGUOUS",
  "ODOO_PARTNER_AMBIGUOUS"
]);

const externalError = (
  error: unknown,
  remoteInvoiceExists: boolean,
  customerSyncCompleted: boolean
): SanitizedExternalError => {
  const sourceCode =
    error instanceof Error && error.name
      ? error.name.slice(0, 64)
      : "INVOICE_EXTERNAL_ERROR";
  const isPermanentCustomerError =
    !remoteInvoiceExists &&
    !customerSyncCompleted &&
    permanentCustomerErrorCodes.has(sourceCode);

  return isPermanentCustomerError
    ? {
        code: `ODOO_REJECTED_CUSTOMER_${sourceCode.replace(/^ODOO_/, "")}`,
        message:
          "Odoo ha rechazado los datos fiscales del cliente. Revisa el NIF y la dirección fiscal antes de reintentar.",
        recoverable: false
      }
    : {
        code: sourceCode,
        message: "No se pudo completar la factura externa; se reconciliará de forma segura",
        recoverable: true
      };
};

export class CreateInvoiceFromDeliveryNotesUseCase {
  public constructor(
    private readonly repository: InvoiceRepository,
    private readonly gateway: InvoiceGateway,
    private readonly config: { enabled: boolean; taxRate: string; series: string | null }
  ) {}

  public async execute(deliveryNoteIds: string[]): Promise<Invoice> {
    return (await this.executeWithResult(deliveryNoteIds)).invoice;
  }

  public async executeWithResult(
    deliveryNoteIds: string[]
  ): Promise<{ invoice: Invoice; created: boolean }> {
    if (!this.config.enabled) {
      throw new DomainException("La facturación Odoo está desactivada", 503);
    }

    const keys = buildInvoiceKeys(deliveryNoteIds);
    const reservation = await this.repository.reserve({
      deliveryNoteIds,
      ...keys,
      series: this.config.series,
      taxRate: this.config.taxRate
    });
    let invoice = reservation.invoice;
    let resumeLeaseToken: string | null = null;
    let customerSyncCompleted = false;
    if (!reservation.created) {
      if (invoice.localState !== "FAILED" || invoice.externalInvoiceId) {
        return { invoice, created: false };
      }
      const now = new Date();
      resumeLeaseToken = await this.repository.acquireReconciliationLease(
        invoice.id,
        now,
        new Date(now.getTime() + 60_000)
      );
      if (!resumeLeaseToken) return { invoice, created: false };
      invoice = (await this.repository.findById(invoice.id)) ?? invoice;
    }

    try {
      const partner = await this.gateway.ensureCustomer(invoice.customer);
      customerSyncCompleted = true;
      if (partner.id !== invoice.customer.externalPartnerId) {
        await this.repository.updateCustomerExternalPartnerId(invoice.customer.customerId, partner.id);
      }

      let remote = await this.gateway.findInvoiceByReference(invoice.remoteReference);
      if (!remote) {
        remote = await this.gateway.createDraftInvoice({
          customerId: partner.id,
          reference: invoice.remoteReference,
          lines: invoice.lines
        });
      }

      invoice = await this.repository.update(invoice.id, {
        localState: "CREATED_REMOTE",
        externalInvoiceId: remote.id,
        number: remote.number,
        odooMoveState: remote.moveState,
        subtotal: remote.subtotal,
        taxAmount: remote.taxAmount,
        total: remote.total,
        lastErrorCode: null,
        lastErrorMessage: null
      });

      if (remote.moveState === "DRAFT") {
        remote = await this.gateway.postInvoice(remote.id);
      }
      await this.gateway.sendInvoice(remote.id);
      const status = await this.gateway.getInvoice(remote.id);

      const linked = await this.repository.markLinked(invoice.id, {
        externalInvoiceId: status.id,
        number: status.number,
        odooMoveState: status.moveState,
        verifactuState: status.verifactuState,
        subtotal: status.subtotal,
        taxAmount: status.taxAmount,
        total: status.total,
        verifactuDocumentId: status.verifactuDocumentId,
        verifactuQrValue: status.qrValue,
        pdfAvailable: status.pdfAvailable,
        nextReconciliationAt:
          status.verifactuState === "PENDING" || status.verifactuState === "NOT_SENT"
            ? new Date(Date.now() + 30_000)
            : null
      });
      return { invoice: linked, created: reservation.created };
    } catch (error: unknown) {
      const sanitized = externalError(
        error,
        Boolean(invoice.externalInvoiceId),
        customerSyncCompleted
      );
      await this.repository.update(invoice.id, {
        localState: sanitized.recoverable
          ? invoice.externalInvoiceId
            ? "RECONCILING"
            : "CREATING"
          : "FAILED",
        lastErrorCode: sanitized.code,
        lastErrorMessage: sanitized.message,
        nextReconciliationAt: sanitized.recoverable ? new Date(Date.now() + 30_000) : null
      });
      throw new DomainException(sanitized.message, sanitized.recoverable ? 502 : 422);
    } finally {
      if (resumeLeaseToken) {
        await this.repository.releaseReconciliationLease(invoice.id, resumeLeaseToken);
      }
    }
  }
}
