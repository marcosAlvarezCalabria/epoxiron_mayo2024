import type { Invoice } from "../../../domain/entities/Invoice.js";
import { DomainException } from "../../../domain/exceptions/DomainException.js";
import type { InvoiceGateway } from "../../../domain/ports/InvoiceGateway.js";
import type { InvoiceRepository } from "../../../domain/repositories/InvoiceRepository.js";
import { buildInvoiceKeys } from "./invoiceKeys.js";

const externalError = (error: unknown): { code: string; message: string } => ({
  code: error instanceof Error && error.name ? error.name.slice(0, 64) : "INVOICE_EXTERNAL_ERROR",
  message: "No se pudo completar la factura externa; se reconciliará de forma segura"
});

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
      const sanitized = externalError(error);
      await this.repository.update(invoice.id, {
        localState: invoice.externalInvoiceId ? "RECONCILING" : "CREATING",
        lastErrorCode: sanitized.code,
        lastErrorMessage: sanitized.message,
        nextReconciliationAt: new Date(Date.now() + 30_000)
      });
      throw new DomainException(sanitized.message, 502);
    } finally {
      if (resumeLeaseToken) {
        await this.repository.releaseReconciliationLease(invoice.id, resumeLeaseToken);
      }
    }
  }
}
