import type { InvoiceRepository } from "../../domain/repositories/InvoiceRepository.js";

interface ReconciliationExecutor {
  execute(invoiceId: string): Promise<unknown>;
}

export class InvoiceReconciliationScheduler {
  private intervalId: NodeJS.Timeout | null = null;

  public constructor(
    private readonly repository: InvoiceRepository,
    private readonly executor: ReconciliationExecutor,
    private readonly config: { enabled: boolean; intervalMs: number; batchSize: number }
  ) {}

  public start(): void {
    if (!this.config.enabled || this.intervalId) return;
    void this.tick();
    this.intervalId = setInterval(() => void this.tick(), this.config.intervalMs);
  }

  public stop(): void {
    if (!this.intervalId) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  public async tick(now = new Date()): Promise<void> {
    if (!this.config.enabled) return;
    const invoices = await this.repository.findDueForReconciliation(now, this.config.batchSize);
    for (const invoice of invoices) {
      try {
        await this.executor.execute(invoice.id);
      } catch (_error: unknown) {
        // El caso de uso persiste un error sanitizado y programa el siguiente intento.
      }
    }
  }
}
