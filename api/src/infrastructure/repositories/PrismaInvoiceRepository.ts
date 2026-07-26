import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { validateFiscalCustomer } from "../../domain/entities/Customer.js";
import type { Invoice } from "../../domain/entities/Invoice.js";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type {
  InvoicePatch,
  InvoiceFilters,
  InvoiceRepository,
  ReserveInvoiceInput
} from "../../domain/repositories/InvoiceRepository.js";
import {
  calculateInvoiceAmounts,
  canonicalDecimal,
  moneyFromNumber,
  unitPriceFromSubtotal
} from "../../domain/services/invoiceMoney.js";
import { buildInvoiceLineDescription } from "../../domain/services/deliveryNoteItemDescription.js";
import { prisma } from "../prisma/client.js";

const invoiceInclude = {
  customer: true,
  lines: { orderBy: { position: "asc" as const } },
  deliveryNotes: true
};

type InvoiceRecord = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

const toDomain = (record: InvoiceRecord): Invoice => ({
  id: record.id,
  idempotencyKey: record.idempotencyKey,
  remoteReference: record.remoteReference,
  series: record.series,
  number: record.number,
  customer: {
    customerId: record.customerId,
    legalName: record.customerLegalName,
    vat: record.customerVat,
    street: record.customerFiscalStreet,
    street2: record.customerFiscalStreet2,
    city: record.customerFiscalCity,
    zip: record.customerFiscalZip,
    province: record.customerProvince,
    countryCode: record.customerCountryCode,
    paymentTermCode: record.paymentTermCode,
    externalPartnerId: record.customer.externalPartnerId
  },
  subtotal: record.subtotal.toFixed(2),
  taxRate: record.taxRate.toFixed(2),
  taxAmount: record.taxAmount.toFixed(2),
  total: record.total.toFixed(2),
  localState: record.localState,
  odooMoveState: record.odooMoveState,
  verifactuState: record.verifactuState,
  externalInvoiceId: record.externalInvoiceId,
  verifactuDocumentId: record.verifactuDocumentId,
  verifactuQrValue: record.verifactuQrValue,
  pdfAvailable: record.pdfAvailable,
  lastErrorCode: record.lastErrorCode,
  lastErrorMessage: record.lastErrorMessage,
  reconciliationAttempts: record.reconciliationAttempts,
  nextReconciliationAt: record.nextReconciliationAt,
  lines: record.lines.map((line) => ({
    id: line.id,
    description: line.description,
    quantity: line.quantity.toFixed(4),
    unitPrice: line.unitPrice.toFixed(4),
    subtotal: line.subtotal.toFixed(2),
    taxRate: line.taxRate.toFixed(2),
    position: line.position
  })),
  deliveryNoteIds: record.deliveryNotes.map((entry) => entry.deliveryNoteId).sort(),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
});

const patchToPrisma = (patch: InvoicePatch): Prisma.InvoiceUpdateInput => ({
  localState: patch.localState,
  odooMoveState: patch.odooMoveState,
  verifactuState: patch.verifactuState,
  externalInvoiceId: patch.externalInvoiceId,
  number: patch.number,
  subtotal: patch.subtotal,
  taxAmount: patch.taxAmount,
  total: patch.total,
  verifactuDocumentId: patch.verifactuDocumentId,
  verifactuQrValue: patch.verifactuQrValue,
  pdfAvailable: patch.pdfAvailable,
  lastErrorCode: patch.lastErrorCode,
  lastErrorMessage: patch.lastErrorMessage,
  reconciliationAttempts: patch.reconciliationAttempts,
  nextReconciliationAt: patch.nextReconciliationAt
});

export class PrismaInvoiceRepository implements InvoiceRepository {
  public async reserve(input: ReserveInvoiceInput) {
    if (input.deliveryNoteIds.length < 1 || input.deliveryNoteIds.length > 100) {
      throw new DomainException("La factura debe incluir entre 1 y 100 albaranes", 422);
    }

    const sortedIds = [...input.deliveryNoteIds].sort();
    if (new Set(sortedIds).size !== sortedIds.length) {
      throw new DomainException("La selección contiene albaranes duplicados", 422);
    }

    try {
      return await prisma.$transaction(async (transaction) => {
        const existing = await transaction.invoice.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: invoiceInclude
        });
        if (existing) return { invoice: toDomain(existing), created: false };

        const notes = await transaction.deliveryNote.findMany({
          where: { id: { in: sortedIds } },
          include: { items: true, customer: { include: { specialPieces: true } } }
        });
        if (notes.length !== sortedIds.length) {
          throw new DomainException("Uno o más albaranes no existen", 422);
        }

        const notesById = new Map(notes.map((note) => [note.id, note]));
        const orderedNotes = sortedIds.map((id) => notesById.get(id)!);
        const customerId = orderedNotes[0]!.customerId;
        if (orderedNotes.some((note) => note.customerId !== customerId)) {
          throw new DomainException("Todos los albaranes deben pertenecer al mismo cliente", 422);
        }
        if (orderedNotes.some((note) => note.status !== "REVIEWED")) {
          throw new DomainException("Solo se pueden facturar albaranes revisados", 422);
        }
        if (orderedNotes.some((note) =>
          note.items.length === 0 ||
          note.totalAmount < 0 ||
          note.items.some((item) => item.quantity <= 0 || item.totalPrice < 0)
        )) {
          throw new DomainException("Los albaranes deben contener líneas con total no negativo", 422);
        }

        const customer = orderedNotes[0]!.customer;
        const fiscalIssues = validateFiscalCustomer(customer);
        if (fiscalIssues.length > 0) {
          throw new DomainException(`Ficha fiscal incompleta: ${fiscalIssues.join(",")}`, 422);
        }

        let position = 0;
        const lines = orderedNotes.flatMap((note) =>
          note.items.map((item) => {
            const subtotal = moneyFromNumber(item.totalPrice);
            const description = buildInvoiceLineDescription(note.number, item);
            if (!description) {
              throw new DomainException("Una línea no tiene descripción comercial completa", 422);
            }
            return {
              description,
              quantity: canonicalDecimal(item.quantity.toString(), 4),
              unitPrice: unitPriceFromSubtotal(subtotal, item.quantity),
              subtotal,
              taxRate: canonicalDecimal(input.taxRate, 2),
              position: position++
            };
          })
        );
        const amounts = calculateInvoiceAmounts(
          lines.map((line) => line.subtotal),
          input.taxRate
        );

        const created = await transaction.invoice.create({
          data: {
            idempotencyKey: input.idempotencyKey,
            remoteReference: input.remoteReference,
            series: input.series,
            customerId,
            customerLegalName: customer.legalName!,
            customerVat: customer.vat!,
            customerFiscalStreet: customer.fiscalStreet!,
            customerFiscalStreet2: customer.fiscalStreet2,
            customerFiscalCity: customer.fiscalCity!,
            customerFiscalZip: customer.fiscalZip!,
            customerProvince: customer.fiscalProvince,
            customerCountryCode: customer.fiscalCountryCode!,
            paymentTermCode: customer.paymentTermCode,
            subtotal: amounts.subtotal,
            taxRate: canonicalDecimal(input.taxRate, 2),
            taxAmount: amounts.taxAmount,
            total: amounts.total,
            lines: { create: lines },
            deliveryNotes: {
              create: sortedIds.map((deliveryNoteId) => ({ deliveryNoteId }))
            }
          },
          include: invoiceInclude
        });

        return { invoice: toDomain(created), created: true };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.findByIdempotencyKey(input.idempotencyKey);
        if (existing) return { invoice: existing, created: false };
        throw new DomainException("Un albarán ya está reservado por otra factura", 409);
      }
      throw error;
    }
  }

  public async findById(id: string) {
    const record = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
    return record ? toDomain(record) : null;
  }

  public async findByIdempotencyKey(key: string) {
    const record = await prisma.invoice.findUnique({
      where: { idempotencyKey: key },
      include: invoiceInclude
    });
    return record ? toDomain(record) : null;
  }

  public async findAll(filters: InvoiceFilters) {
    const records = await prisma.invoice.findMany({
      where: {
        customerId: filters.customerId,
        localState: filters.localState,
        verifactuState: filters.verifactuState
      },
      take: filters.limit,
      skip: filters.offset,
      include: invoiceInclude,
      orderBy: { createdAt: "desc" }
    });
    return records.map(toDomain);
  }

  public async count(filters: Omit<InvoiceFilters, "limit" | "offset">) {
    return prisma.invoice.count({
      where: {
        customerId: filters.customerId,
        localState: filters.localState,
        verifactuState: filters.verifactuState
      }
    });
  }

  public async findDueForReconciliation(now: Date, limit: number) {
    const records = await prisma.invoice.findMany({
      where: {
        nextReconciliationAt: { lte: now },
        OR: [
          { localState: { in: ["CREATING", "CREATED_REMOTE", "RECONCILING"] } },
          { verifactuState: { in: ["NOT_SENT", "PENDING"] } }
        ]
      },
      take: limit,
      include: invoiceInclude,
      orderBy: { nextReconciliationAt: "asc" }
    });
    return records.map(toDomain);
  }

  public async update(id: string, patch: InvoicePatch) {
    const record = await prisma.invoice.update({
      where: { id },
      data: patchToPrisma(patch),
      include: invoiceInclude
    });
    return toDomain(record);
  }

  public async markLinked(id: string, patch: InvoicePatch) {
    return prisma.$transaction(async (transaction) => {
      const record = await transaction.invoice.update({
        where: { id },
        data: { ...patchToPrisma(patch), localState: patch.localState ?? "LINKED" },
        include: invoiceInclude
      });
      await transaction.deliveryNote.updateMany({
        where: { invoices: { some: { invoiceId: id } } },
        data: { status: "INVOICED" }
      });
      return toDomain(record);
    });
  }

  public async acquireReconciliationLease(id: string, now: Date, leaseUntil: Date) {
    const leaseToken = randomUUID();
    const result = await prisma.invoice.updateMany({
      where: {
        id,
        OR: [{ reconciliationLeaseUntil: null }, { reconciliationLeaseUntil: { lt: now } }]
      },
      data: {
        reconciliationLeaseUntil: leaseUntil,
        reconciliationLeaseToken: leaseToken,
        localState: "RECONCILING"
      }
    });
    return result.count === 1 ? leaseToken : null;
  }

  public async releaseReconciliationLease(id: string, leaseToken: string) {
    await prisma.invoice.updateMany({
      where: { id, reconciliationLeaseToken: leaseToken },
      data: { reconciliationLeaseUntil: null, reconciliationLeaseToken: null }
    });
  }

  public async updateCustomerExternalPartnerId(customerId: string, externalPartnerId: string) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { externalPartnerId }
    });
  }
}
