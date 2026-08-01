import { DomainException } from "../../../domain/exceptions/DomainException.js";
import type { InvoiceRepository } from "../../../domain/repositories/InvoiceRepository.js";

export class GetInvoiceUseCase {
  public constructor(private readonly repository: InvoiceRepository) {}

  public async execute(id: string) {
    const invoice = await this.repository.findById(id);
    if (!invoice) throw new DomainException("Factura no encontrada", 404);
    return invoice;
  }
}
