import { DomainException } from "../../../domain/exceptions/DomainException.js";
import type { InvoiceGateway } from "../../../domain/ports/InvoiceGateway.js";
import type { InvoiceRepository } from "../../../domain/repositories/InvoiceRepository.js";

export class GetInvoicePdfUseCase {
  public constructor(
    private readonly repository: InvoiceRepository,
    private readonly gateway: InvoiceGateway
  ) {}

  public async execute(id: string) {
    const invoice = await this.repository.findById(id);
    if (!invoice) throw new DomainException("Factura no encontrada", 404);
    if (!invoice.externalInvoiceId || !invoice.pdfAvailable) {
      throw new DomainException("El PDF de la factura todavía no está disponible", 409);
    }
    return {
      invoice,
      pdf: await this.gateway.fetchInvoicePdf(invoice.externalInvoiceId)
    };
  }
}
