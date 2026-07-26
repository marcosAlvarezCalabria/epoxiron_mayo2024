import type { InvoiceGateway } from "../../../domain/ports/InvoiceGateway.js";
import type { InvoiceRepository } from "../../../domain/repositories/InvoiceRepository.js";
import { DomainException } from "../../../domain/exceptions/DomainException.js";

const nextAttemptAt = (attempt: number): Date => {
  const delay = Math.min(30_000 * 2 ** Math.max(attempt - 1, 0), 15 * 60_000);
  return new Date(Date.now() + delay);
};

export class ReconcileInvoiceUseCase {
  public constructor(
    private readonly repository: InvoiceRepository,
    private readonly gateway: InvoiceGateway,
    private readonly maxAttempts: number
  ) {}

  public async execute(invoiceId: string) {
    const current = await this.repository.findById(invoiceId);
    if (!current) throw new DomainException("Factura no encontrada", 404);
    if (current.verifactuState === "ACCEPTED" || current.verifactuState === "REJECTED") return current;

    const now = new Date();
    const leaseToken = await this.repository.acquireReconciliationLease(
      invoiceId,
      now,
      new Date(now.getTime() + 60_000)
    );
    if (!leaseToken) return this.repository.findById(invoiceId);

    const attempt = current.reconciliationAttempts + 1;
    try {
      let externalInvoiceId = current.externalInvoiceId;
      if (!externalInvoiceId) {
        const remote = await this.gateway.findInvoiceByReference(current.remoteReference);
        externalInvoiceId = remote?.id ?? null;
      }

      if (!externalInvoiceId) {
        return this.repository.update(invoiceId, {
          localState: attempt >= this.maxAttempts ? "FAILED" : "RECONCILING",
          reconciliationAttempts: attempt,
          nextReconciliationAt: attempt >= this.maxAttempts ? null : nextAttemptAt(attempt),
          lastErrorCode: "REMOTE_INVOICE_NOT_FOUND",
          lastErrorMessage: "No se encontró todavía la factura remota"
        });
      }

      let status = await this.gateway.getInvoice(externalInvoiceId);
      if (status.moveState === "DRAFT") {
        await this.gateway.postInvoice(externalInvoiceId);
        await this.gateway.sendInvoice(externalInvoiceId);
        status = await this.gateway.getInvoice(externalInvoiceId);
      } else if (status.moveState === "POSTED" && status.verifactuState === "NOT_SENT") {
        await this.gateway.sendInvoice(externalInvoiceId);
        status = await this.gateway.getInvoice(externalInvoiceId);
      }
      const attemptsExhausted =
        attempt >= this.maxAttempts &&
        (status.verifactuState === "PENDING" || status.verifactuState === "NOT_SENT");
      return this.repository.markLinked(invoiceId, {
        localState: attemptsExhausted ? "FAILED" : "LINKED",
        externalInvoiceId,
        number: status.number,
        odooMoveState: status.moveState,
        verifactuState: status.verifactuState,
        subtotal: status.subtotal,
        taxAmount: status.taxAmount,
        total: status.total,
        verifactuDocumentId: status.verifactuDocumentId,
        verifactuQrValue: status.qrValue,
        pdfAvailable: status.pdfAvailable,
        reconciliationAttempts: attempt,
        nextReconciliationAt:
          !attemptsExhausted &&
          (status.verifactuState === "PENDING" || status.verifactuState === "NOT_SENT")
            ? nextAttemptAt(attempt)
            : null,
        lastErrorCode: attemptsExhausted
          ? "RECONCILIATION_ATTEMPTS_EXHAUSTED"
          : status.rejectionReason
            ? "VERIFACTU_REJECTED"
            : null,
        lastErrorMessage: attemptsExhausted
          ? "VeriFactu no alcanzó un estado terminal dentro del límite de intentos"
          : status.rejectionReason
      });
    } catch (_error: unknown) {
      return this.repository.update(invoiceId, {
        localState: attempt >= this.maxAttempts ? "FAILED" : "RECONCILING",
        reconciliationAttempts: attempt,
        nextReconciliationAt: attempt >= this.maxAttempts ? null : nextAttemptAt(attempt),
        lastErrorCode: "RECONCILIATION_ERROR",
        lastErrorMessage: "La reconciliación no pudo completarse"
      });
    } finally {
      await this.repository.releaseReconciliationLease(invoiceId, leaseToken);
    }
  }
}
