import type {
  InvoiceFilters,
  InvoiceRepository
} from "../../../domain/repositories/InvoiceRepository.js";

export class ListInvoicesUseCase {
  public constructor(private readonly repository: InvoiceRepository) {}

  public async execute(filters: InvoiceFilters) {
    const [invoices, total] = await Promise.all([
      this.repository.findAll(filters),
      this.repository.count({
        customerId: filters.customerId,
        localState: filters.localState,
        verifactuState: filters.verifactuState
      })
    ]);
    return {
      invoices,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + invoices.length < total
      }
    };
  }
}
