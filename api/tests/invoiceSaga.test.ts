import { describe, expect, it, vi } from "vitest";
import type { Customer } from "../src/domain/entities/Customer.js";
import type { DeliveryNote } from "../src/domain/entities/DeliveryNote.js";
import type {
  RemoteInvoice,
  RemoteInvoiceStatus
} from "../src/domain/ports/InvoiceGateway.js";
import { CreateInvoiceFromDeliveryNotesUseCase } from "../src/application/use-cases/invoices/createInvoiceFromDeliveryNotes.js";
import { ReconcileInvoiceUseCase } from "../src/application/use-cases/invoices/reconcileInvoice.js";
import { InMemoryInvoiceRepository } from "../src/infrastructure/repositories/InMemoryInvoiceRepository.js";

const customer = (id = "customer-1"): Customer => ({
  id,
  name: "Taller Norte",
  email: null,
  phone: null,
  address: null,
  notes: null,
  vat: "B12345678",
  legalName: "Taller Norte SL",
  fiscalStreet: "Calle Mayor 1",
  fiscalStreet2: null,
  fiscalCity: "Madrid",
  fiscalZip: "28001",
  fiscalProvince: "Madrid",
  fiscalCountryCode: "ES",
  paymentTermCode: "30D",
  externalPartnerId: null,
  pricePerLinearMeter: 10,
  pricePerSquareMeter: 20,
  minimumRate: 5,
  grosorPrecio: null,
  specialPieces: [],
  createdAt: new Date(),
  updatedAt: new Date()
});

const note = (id: string, customerId = "customer-1"): DeliveryNote => ({
  id,
  number: `ALB-${id}`,
  customerId,
  customerName: "Taller Norte",
  status: "REVIEWED",
  notes: null,
  totalAmount: 10,
  date: new Date(),
  items: [{
    description: "Pieza",
    color: "RAL 9005",
    texture: "NORMAL",
    pricingMode: "UNIT",
    customUnitPrice: 10,
    quantity: 1,
    unitPrice: 10,
    totalPrice: 10
  }],
  createdAt: new Date(),
  updatedAt: new Date()
});

const remote = (state: RemoteInvoiceStatus["verifactuState"] = "ACCEPTED"): RemoteInvoiceStatus => ({
  id: "101",
  number: "INV/2026/0001",
  moveState: "POSTED",
  subtotal: "10.00",
  taxAmount: "2.10",
  total: "12.10",
  verifactuState: state,
  verifactuDocumentId: state === "ACCEPTED" ? "55" : null,
  qrValue: state === "ACCEPTED" ? "qr-value" : null,
  rejectionReason: null,
  pdfAvailable: state === "ACCEPTED"
});

const gateway = () => ({
  ensureCustomer: vi.fn(async () => ({ id: "9" })),
  findInvoiceByReference: vi.fn(async (): Promise<RemoteInvoice | null> => null),
  createDraftInvoice: vi.fn(async (): Promise<RemoteInvoice> => ({
    ...remote("NOT_SENT"),
    moveState: "DRAFT"
  })),
  postInvoice: vi.fn(async (): Promise<RemoteInvoice> => remote("NOT_SENT")),
  sendInvoice: vi.fn(async () => undefined),
  getInvoice: vi.fn(async () => remote()),
  fetchInvoicePdf: vi.fn(async () => Buffer.from("%PDF-test"))
});

describe("invoice saga", () => {
  it("creates, posts, sends and links one invoice", async () => {
    const notes = [note("1"), note("2")];
    const repository = new InMemoryInvoiceRepository([customer()], notes);
    const fakeGateway = gateway();
    const useCase = new CreateInvoiceFromDeliveryNotesUseCase(repository, fakeGateway, {
      enabled: true,
      taxRate: "21",
      series: null
    });

    const result = await useCase.execute(["2", "1"]);

    expect(result.localState).toBe("LINKED");
    expect(result.verifactuState).toBe("ACCEPTED");
    expect(result.deliveryNoteIds).toEqual(["1", "2"]);
    expect(notes.every((entry) => entry.status === "INVOICED")).toBe(true);
    expect(fakeGateway.createDraftInvoice).toHaveBeenCalledOnce();
    expect(fakeGateway.sendInvoice).toHaveBeenCalledOnce();
  });

  it("returns the same invoice on a repeated request", async () => {
    const repository = new InMemoryInvoiceRepository([customer()], [note("1")]);
    const fakeGateway = gateway();
    const useCase = new CreateInvoiceFromDeliveryNotesUseCase(repository, fakeGateway, {
      enabled: true,
      taxRate: "21",
      series: null
    });

    const first = await useCase.execute(["1"]);
    const second = await useCase.execute(["1"]);

    expect(second.id).toBe(first.id);
    expect(fakeGateway.createDraftInvoice).toHaveBeenCalledOnce();
  });

  it("deduplicates two concurrent requests", async () => {
    const repository = new InMemoryInvoiceRepository([customer()], [note("1")]);
    const fakeGateway = gateway();
    const useCase = new CreateInvoiceFromDeliveryNotesUseCase(repository, fakeGateway, {
      enabled: true,
      taxRate: "21",
      series: null
    });

    const [first, second] = await Promise.all([useCase.execute(["1"]), useCase.execute(["1"])]);

    expect(first.id).toBe(second.id);
    expect(repository.invoices.size).toBe(1);
  });

  it("keeps a pending invoice scheduled for reconciliation", async () => {
    const repository = new InMemoryInvoiceRepository([customer()], [note("1")]);
    const fakeGateway = gateway();
    fakeGateway.getInvoice.mockResolvedValue(remote("PENDING"));
    const useCase = new CreateInvoiceFromDeliveryNotesUseCase(repository, fakeGateway, {
      enabled: true,
      taxRate: "21",
      series: null
    });

    const result = await useCase.execute(["1"]);

    expect(result.verifactuState).toBe("PENDING");
    expect(result.nextReconciliationAt).toBeInstanceOf(Date);
  });

  it("rejects albaranes from different customers before calling Odoo", async () => {
    const repository = new InMemoryInvoiceRepository(
      [customer(), customer("customer-2")],
      [note("1"), note("2", "customer-2")]
    );
    const fakeGateway = gateway();
    const useCase = new CreateInvoiceFromDeliveryNotesUseCase(repository, fakeGateway, {
      enabled: true,
      taxRate: "21",
      series: null
    });

    await expect(useCase.execute(["1", "2"])).rejects.toMatchObject({ statusCode: 422 });
    expect(fakeGateway.ensureCustomer).not.toHaveBeenCalled();
  });

  it("adopts a remote invoice after a timeout without creating another", async () => {
    const repository = new InMemoryInvoiceRepository([customer()], [note("1")]);
    const fakeGateway = gateway();
    fakeGateway.createDraftInvoice.mockRejectedValueOnce(new Error("timeout"));
    const createUseCase = new CreateInvoiceFromDeliveryNotesUseCase(repository, fakeGateway, {
      enabled: true,
      taxRate: "21",
      series: null
    });
    await expect(createUseCase.execute(["1"])).rejects.toMatchObject({ statusCode: 502 });
    const saved = [...repository.invoices.values()][0]!;
    fakeGateway.findInvoiceByReference.mockResolvedValue(remote("NOT_SENT"));
    const reconcile = new ReconcileInvoiceUseCase(repository, fakeGateway, 5);

    const result = await reconcile.execute(saved.id);

    expect(result?.externalInvoiceId).toBe("101");
    expect(fakeGateway.createDraftInvoice).toHaveBeenCalledOnce();
  });

  it("persists a VeriFactu rejection as a terminal state", async () => {
    const repository = new InMemoryInvoiceRepository([customer()], [note("1")]);
    const fakeGateway = gateway();
    fakeGateway.getInvoice.mockResolvedValue({
      ...remote("REJECTED"),
      rejectionReason: "Dato fiscal rechazado"
    });
    const useCase = new CreateInvoiceFromDeliveryNotesUseCase(repository, fakeGateway, {
      enabled: true,
      taxRate: "21",
      series: null
    });

    const result = await useCase.execute(["1"]);

    expect(result.verifactuState).toBe("REJECTED");
    expect(result.nextReconciliationAt).toBeNull();
  });

  it("never creates a remote invoice from reconciliation", async () => {
    const repository = new InMemoryInvoiceRepository([customer()], [note("1")]);
    const fakeGateway = gateway();
    fakeGateway.createDraftInvoice.mockRejectedValueOnce(new Error("timeout"));
    const createUseCase = new CreateInvoiceFromDeliveryNotesUseCase(repository, fakeGateway, {
      enabled: true,
      taxRate: "21",
      series: null
    });
    await expect(createUseCase.execute(["1"])).rejects.toBeDefined();
    const saved = [...repository.invoices.values()][0]!;
    const reconcile = new ReconcileInvoiceUseCase(repository, fakeGateway, 1);

    const result = await reconcile.execute(saved.id);

    expect(result?.localState).toBe("FAILED");
    expect(fakeGateway.createDraftInvoice).toHaveBeenCalledOnce();
  });

  it("allows a safe retry after reconciliation proves no remote invoice exists", async () => {
    const repository = new InMemoryInvoiceRepository([customer()], [note("1")]);
    const fakeGateway = gateway();
    fakeGateway.createDraftInvoice.mockRejectedValueOnce(new Error("timeout"));
    const createUseCase = new CreateInvoiceFromDeliveryNotesUseCase(repository, fakeGateway, {
      enabled: true,
      taxRate: "21",
      series: null
    });
    await expect(createUseCase.execute(["1"])).rejects.toBeDefined();
    const saved = [...repository.invoices.values()][0]!;
    await new ReconcileInvoiceUseCase(repository, fakeGateway, 1).execute(saved.id);

    const retried = await createUseCase.execute(["1"]);

    expect(retried.localState).toBe("LINKED");
    expect(fakeGateway.createDraftInvoice).toHaveBeenCalledTimes(2);
    expect(repository.invoices.size).toBe(1);
  });
});
