import { describe, expect, it, vi } from "vitest";
import { InvoiceReconciliationScheduler } from "../src/infrastructure/services/InvoiceReconciliationScheduler.js";

describe("InvoiceReconciliationScheduler", () => {
  it("processes only due invoices in the returned batch", async () => {
    const repository = {
      findDueForReconciliation: vi.fn(async () => [
        { id: "invoice-1" },
        { id: "invoice-2" }
      ])
    };
    const executor = { execute: vi.fn(async () => undefined) };
    const scheduler = new InvoiceReconciliationScheduler(
      repository as never,
      executor,
      { enabled: true, intervalMs: 30_000, batchSize: 20 }
    );
    const now = new Date("2026-07-26T10:00:00.000Z");

    await scheduler.tick(now);

    expect(repository.findDueForReconciliation).toHaveBeenCalledWith(now, 20);
    expect(executor.execute).toHaveBeenCalledTimes(2);
  });

  it("does nothing while disabled", async () => {
    const repository = { findDueForReconciliation: vi.fn() };
    const executor = { execute: vi.fn() };
    const scheduler = new InvoiceReconciliationScheduler(
      repository as never,
      executor,
      { enabled: false, intervalMs: 30_000, batchSize: 20 }
    );

    await scheduler.tick();

    expect(repository.findDueForReconciliation).not.toHaveBeenCalled();
  });
});
