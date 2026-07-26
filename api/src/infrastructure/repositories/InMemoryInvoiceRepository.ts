import { randomUUID } from "node:crypto";
import type { Customer } from "../../domain/entities/Customer.js";
import { validateFiscalCustomer } from "../../domain/entities/Customer.js";
import type { DeliveryNote } from "../../domain/entities/DeliveryNote.js";
import type { Invoice } from "../../domain/entities/Invoice.js";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type {
  InvoicePatch,
  InvoiceRepository,
  ReserveInvoiceInput
} from "../../domain/repositories/InvoiceRepository.js";
import {
  calculateInvoiceAmounts,
  canonicalDecimal,
  moneyFromNumber,
  unitPriceFromSubtotal
} from "../../domain/services/invoiceMoney.js";

export class InMemoryInvoiceRepository implements InvoiceRepository {
  public readonly invoices = new Map<string, Invoice>();
  public readonly externalPartnerIds = new Map<string, string>();
  private readonly leases = new Map<string, { until: Date; token: string }>();

  public constructor(
    private readonly customers: Customer[] = [],
    private readonly deliveryNotes: DeliveryNote[] = []
  ) {}

  public async reserve(input: ReserveInvoiceInput) {
    const existing = [...this.invoices.values()].find(
      (invoice) => invoice.idempotencyKey === input.idempotencyKey
    );
    if (existing) return { invoice: structuredClone(existing), created: false };

    const ids = [...input.deliveryNoteIds].sort();
    if (ids.length < 1 || ids.length > 100 || new Set(ids).size !== ids.length) {
      throw new DomainException("Selección de albaranes inválida", 422);
    }
    const notes = ids.map((id) => this.deliveryNotes.find((note) => note.id === id));
    if (notes.some((note) => !note)) throw new DomainException("Uno o más albaranes no existen", 422);
    const selected = notes as DeliveryNote[];
    const customerId = selected[0]!.customerId;
    if (selected.some((note) => note.customerId !== customerId)) {
      throw new DomainException("Todos los albaranes deben pertenecer al mismo cliente", 422);
    }
    if (selected.some((note) =>
      note.status !== "REVIEWED" ||
      note.items.length === 0 ||
      note.totalAmount < 0 ||
      note.items.some((item) => item.quantity <= 0 || item.totalPrice < 0)
    )) {
      throw new DomainException("Solo se pueden facturar albaranes revisados con líneas", 422);
    }
    if ([...this.invoices.values()].some((invoice) =>
      invoice.deliveryNoteIds.some((id) => ids.includes(id)))) {
      throw new DomainException("Un albarán ya está reservado por otra factura", 409);
    }

    const customer = this.customers.find((entry) => entry.id === customerId);
    if (!customer) throw new DomainException("Cliente no encontrado", 422);
    const issues = validateFiscalCustomer(customer);
    if (issues.length) throw new DomainException(`Ficha fiscal incompleta: ${issues.join(",")}`, 422);

    let position = 0;
    const lines = selected.flatMap((note) =>
      note.items.map((item) => {
        const subtotal = moneyFromNumber(item.totalPrice);
        return {
          description: `${note.number} · ${item.description}`,
          quantity: canonicalDecimal(item.quantity.toString(), 4),
          unitPrice: unitPriceFromSubtotal(subtotal, item.quantity),
          subtotal,
          taxRate: canonicalDecimal(input.taxRate, 2),
          position: position++
        };
      })
    );
    const amounts = calculateInvoiceAmounts(lines.map((line) => line.subtotal), input.taxRate);
    const now = new Date();
    const invoice: Invoice = {
      id: randomUUID(),
      idempotencyKey: input.idempotencyKey,
      remoteReference: input.remoteReference,
      series: input.series,
      number: null,
      customer: {
        customerId,
        legalName: customer.legalName!,
        vat: customer.vat!,
        street: customer.fiscalStreet!,
        street2: customer.fiscalStreet2,
        city: customer.fiscalCity!,
        zip: customer.fiscalZip!,
        province: customer.fiscalProvince,
        countryCode: customer.fiscalCountryCode!,
        paymentTermCode: customer.paymentTermCode,
        externalPartnerId: customer.externalPartnerId
      },
      ...amounts,
      taxRate: canonicalDecimal(input.taxRate, 2),
      localState: "CREATING",
      odooMoveState: null,
      verifactuState: "NOT_SENT",
      externalInvoiceId: null,
      verifactuDocumentId: null,
      verifactuQrValue: null,
      pdfAvailable: false,
      lastErrorCode: null,
      lastErrorMessage: null,
      reconciliationAttempts: 0,
      nextReconciliationAt: null,
      lines,
      deliveryNoteIds: ids,
      createdAt: now,
      updatedAt: now
    };
    this.invoices.set(invoice.id, invoice);
    return { invoice: structuredClone(invoice), created: true };
  }

  public async findById(id: string) {
    const invoice = this.invoices.get(id);
    return invoice ? structuredClone(invoice) : null;
  }

  public async findByIdempotencyKey(key: string) {
    const invoice = [...this.invoices.values()].find((entry) => entry.idempotencyKey === key);
    return invoice ? structuredClone(invoice) : null;
  }

  public async findDueForReconciliation(now: Date, limit: number) {
    return [...this.invoices.values()]
      .filter((invoice) => invoice.nextReconciliationAt && invoice.nextReconciliationAt <= now)
      .slice(0, limit)
      .map((invoice) => structuredClone(invoice));
  }

  public async update(id: string, patch: InvoicePatch) {
    const current = this.invoices.get(id);
    if (!current) throw new DomainException("Factura no encontrada", 404);
    const updated = { ...current, ...patch, updatedAt: new Date() };
    this.invoices.set(id, updated);
    return structuredClone(updated);
  }

  public async markLinked(id: string, patch: InvoicePatch) {
    const updated = await this.update(id, {
      ...patch,
      localState: patch.localState ?? "LINKED"
    });
    this.deliveryNotes.forEach((note) => {
      if (updated.deliveryNoteIds.includes(note.id)) note.status = "INVOICED";
    });
    return updated;
  }

  public async acquireReconciliationLease(id: string, now: Date, leaseUntil: Date) {
    const current = this.leases.get(id);
    if (current && current.until >= now) return null;
    const token = randomUUID();
    this.leases.set(id, { until: leaseUntil, token });
    await this.update(id, { localState: "RECONCILING" });
    return token;
  }

  public async releaseReconciliationLease(id: string, leaseToken: string) {
    if (this.leases.get(id)?.token === leaseToken) {
      this.leases.delete(id);
    }
  }

  public async updateCustomerExternalPartnerId(customerId: string, externalPartnerId: string) {
    this.externalPartnerIds.set(customerId, externalPartnerId);
    const customer = this.customers.find((entry) => entry.id === customerId);
    if (customer) customer.externalPartnerId = externalPartnerId;
  }
}
