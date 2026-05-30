import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer, CustomerInput } from "../src/domain/entities/Customer.js";
import type {
  DeliveryNote,
  DeliveryNoteFilters,
  DeliveryNoteInput,
  DeliveryNoteStatus
} from "../src/domain/entities/DeliveryNote.js";
import { CalculatePriceUseCase } from "../src/application/use-cases/deliveryNotes.js";
import {
  ChangeDeliveryNoteStatusUseCase,
  CreateDeliveryNoteUseCase,
  DeleteDeliveryNoteUseCase,
  GetDashboardSummaryUseCase,
  GetDeliveryNoteUseCase,
  GetDeliveryNotesUseCase,
  UpdateDeliveryNoteUseCase
} from "../src/application/use-cases/deliveryNotes.js";

class InMemoryCustomerRepository {
  public customers: Customer[] = [];
  public update = vi.fn(async (id: string, input: CustomerInput) => {
    const current = this.customers.find((customer) => customer.id === id);
    if (!current) {
      throw new Error("customer not found");
    }

    const updated: Customer = {
      ...current,
      ...input,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      grosorPrecio: input.grosorPrecio ?? null,
      updatedAt: new Date()
    };

    this.customers = this.customers.map((customer) => (customer.id === id ? updated : customer));
    return updated;
  });

  public async findAll() {
    return this.customers;
  }

  public async findById(id: string) {
    return this.customers.find((customer) => customer.id === id) ?? null;
  }

  public async findByName(name: string) {
    return (
      this.customers.find((customer) => customer.name.toLowerCase() === name.trim().toLowerCase()) ??
      null
    );
  }

  public async findByEmail(email: string) {
    return (
      this.customers.find(
        (customer) => customer.email?.toLowerCase() === email.trim().toLowerCase()
      ) ?? null
    );
  }

  public async create(_input: CustomerInput): Promise<Customer> {
    throw new Error("not implemented");
  }

  public async delete() {
    throw new Error("not implemented");
  }

  public async hasDeliveryNotes() {
    return false;
  }
}

class InMemoryDeliveryNoteRepository {
  public notes: DeliveryNote[] = [];
  public create = vi.fn(
    async (
      input: DeliveryNoteInput & {
        number: string;
        customerName: string;
        totalAmount: number;
        items: DeliveryNote["items"];
      }
    ) => {
      const created: DeliveryNote = {
        id: crypto.randomUUID(),
        number: input.number,
        customerId: input.customerId,
        customerName: input.customerName,
        status: input.status,
        notes: input.notes ?? null,
        totalAmount: input.totalAmount,
        date: input.date ?? new Date(),
        items: input.items,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.notes.push(created);
      return created;
    }
  );
  public update = vi.fn(
    async (
      id: string,
      input: DeliveryNoteInput & {
        number: string;
        customerName: string;
        totalAmount: number;
        items: DeliveryNote["items"];
      }
    ) => {
      const updated: DeliveryNote = {
        id,
        number: input.number,
        customerId: input.customerId,
        customerName: input.customerName,
        status: input.status,
        notes: input.notes ?? null,
        totalAmount: input.totalAmount,
        date: input.date ?? new Date(),
        items: input.items,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.notes = this.notes.map((note) => (note.id === id ? updated : note));
      return updated;
    }
  );
  public delete = vi.fn(async (id: string) => {
    this.notes = this.notes.filter((note) => note.id !== id);
  });
  public updateStatus = vi.fn(async (id: string, status: DeliveryNoteStatus) => {
    const note = this.notes.find((entry) => entry.id === id)!;
    const updated = { ...note, status, updatedAt: new Date() };
    this.notes = this.notes.map((entry) => (entry.id === id ? updated : entry));
    return updated;
  });

  public async findAll(filters: DeliveryNoteFilters) {
    const filtered = this.notes.filter((note) => {
      if (filters.status && note.status !== filters.status) {
        return false;
      }
      if (filters.customerId && note.customerId !== filters.customerId) {
        return false;
      }
      if (filters.today || filters.date) {
        const referenceDate = filters.date ?? new Date();
        const sameDay =
          note.date.getFullYear() === referenceDate.getFullYear() &&
          note.date.getMonth() === referenceDate.getMonth() &&
          note.date.getDate() === referenceDate.getDate();

        if (!sameDay) {
          return false;
        }
      }
      return true;
    });

    const offset = filters.offset ?? 0;
    const end = typeof filters.limit === "number" ? offset + filters.limit : undefined;
    return filtered.slice(offset, end);
  }

  public async count(filters: DeliveryNoteFilters) {
    return this.notes.filter((note) => {
      if (filters.status && note.status !== filters.status) {
        return false;
      }
      if (filters.customerId && note.customerId !== filters.customerId) {
        return false;
      }
      if (filters.today || filters.date) {
        const referenceDate = filters.date ?? new Date();
        const sameDay =
          note.date.getFullYear() === referenceDate.getFullYear() &&
          note.date.getMonth() === referenceDate.getMonth() &&
          note.date.getDate() === referenceDate.getDate();

        if (!sameDay) {
          return false;
        }
      }
      return true;
    }).length;
  }

  public async findById(id: string) {
    return this.notes.find((note) => note.id === id) ?? null;
  }

  public async findLatestNumberForYear(year: number) {
    const prefix = `ALB-${year}-`;
    const matches = this.notes
      .map((note) => note.number)
      .filter((number) => number.startsWith(prefix))
      .sort((left, right) => right.localeCompare(left));

    return matches[0] ?? null;
  }
}

const buildCustomer = (): Customer => ({
  id: "customer-1",
  name: "Pinturas Lopez",
  email: null,
  phone: null,
  address: null,
  notes: null,
  pricePerLinearMeter: 10,
  pricePerSquareMeter: 20,
  minimumRate: 15,
  grosorPrecio: 5,
  specialPieces: [{ name: "Barandilla", price: 40 }],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z")
});

const buildNote = (
  id: string,
  status: DeliveryNoteStatus,
  date = "2026-01-01T00:00:00.000Z"
): DeliveryNote => ({
  id,
  number: `ALB-${id}`,
  customerId: "customer-1",
  customerName: "Pinturas Lopez",
  status,
  notes: null,
  totalAmount: status === "REVIEWED" ? 120 : 45,
  date: new Date(date),
  items: [
    {
      description: "Perfil",
      color: "RAL 9005",
      quantity: status === "REVIEWED" ? 4 : 2,
      unitPrice: status === "REVIEWED" ? 30 : 22.5,
      totalPrice: status === "REVIEWED" ? 120 : 45,
      linearMeters: status === "REVIEWED" ? 3 : null,
      squareMeters: null,
      thickness: null
    }
  ],
  createdAt: new Date(date),
  updatedAt: new Date(date)
});

describe("delivery note use cases", () => {
  let customerRepository: InMemoryCustomerRepository;
  let deliveryNoteRepository: InMemoryDeliveryNoteRepository;
  let calculatePriceUseCase: CalculatePriceUseCase;

  beforeEach(() => {
    customerRepository = new InMemoryCustomerRepository();
    customerRepository.customers = [buildCustomer()];
    deliveryNoteRepository = new InMemoryDeliveryNoteRepository();
    deliveryNoteRepository.notes = [
      buildNote("note-draft", "DRAFT", "2026-01-01T00:00:00.000Z"),
      buildNote("note-reviewed", "REVIEWED", "2026-01-01T00:00:00.000Z"),
      buildNote("note-pending", "PENDING", "2026-01-02T00:00:00.000Z")
    ];
    calculatePriceUseCase = new CalculatePriceUseCase();
  });

  it("creates a delivery note with prices calculated by business rules", async () => {
    const useCase = new CreateDeliveryNoteUseCase(
      customerRepository,
      deliveryNoteRepository,
      calculatePriceUseCase
    );

    const result = await useCase.execute({
      customerId: "customer-1",
      status: "DRAFT",
      items: [
        {
          description: "Barandilla",
          color: "RAL 7016",
          quantity: 2
        },
        {
          description: "Perfil",
          color: "RAL 9005",
          linearMeters: 1,
          thickness: 4,
          quantity: 1
        }
      ]
    });

    expect(deliveryNoteRepository.create).toHaveBeenCalledOnce();
    expect(result.number).toBe("ALB-2026-0001");
    expect(result.customerName).toBe("Pinturas Lopez");
    expect(result.totalAmount).toBe(110);
    expect(result.items[0]?.totalPrice).toBe(80);
    expect(result.items[1]?.totalPrice).toBe(30);
  });

  it("fails creating a delivery note for an unknown customer", async () => {
    const useCase = new CreateDeliveryNoteUseCase(
      customerRepository,
      deliveryNoteRepository,
      calculatePriceUseCase
    );

    await expect(
      useCase.execute({
        customerId: "missing",
        status: "DRAFT",
        items: [{ description: "Perfil", color: "RAL 9005", quantity: 1, linearMeters: 2 }]
      })
    ).rejects.toMatchObject({
      message: "Cliente no encontrado",
      statusCode: 404
    });
  });

  it("updates a delivery note recalculating totals", async () => {
    const useCase = new UpdateDeliveryNoteUseCase(
      customerRepository,
      deliveryNoteRepository,
      calculatePriceUseCase
    );

    const result = await useCase.execute("note-draft", {
      customerId: "customer-1",
      status: "PENDING",
      items: [{ description: "Perfil", color: "RAL 9005", quantity: 2, linearMeters: 1 }]
    });

    expect(deliveryNoteRepository.update).toHaveBeenCalledOnce();
    expect(result.number).toBe("ALB-note-draft");
    expect(result.totalAmount).toBe(30);
    expect(result.status).toBe("PENDING");
  });

  it("saves a new special piece when the item switch is enabled", async () => {
    const useCase = new CreateDeliveryNoteUseCase(
      customerRepository,
      deliveryNoteRepository,
      calculatePriceUseCase
    );

    const result = await useCase.execute({
      customerId: "customer-1",
      status: "DRAFT",
      items: [
        {
          description: "Puerta peatonal",
          color: "RAL 7016",
          linearMeters: 2,
          quantity: 1,
          saveAsSpecialPiece: true
        }
      ]
    });

    expect(customerRepository.update).toHaveBeenCalledOnce();
    expect(customerRepository.customers[0]?.specialPieces).toEqual([
      { name: "Barandilla", price: 40 },
      { name: "Puerta peatonal", price: 20 }
    ]);
    expect(result.items[0]?.unitPrice).toBe(20);
    expect(result.items[0]?.totalPrice).toBe(20);
  });

  it("blocks deleting non-draft delivery notes", async () => {
    const useCase = new DeleteDeliveryNoteUseCase(deliveryNoteRepository);

    await expect(useCase.execute("note-reviewed")).rejects.toMatchObject({
      message: "Solo se pueden eliminar albaranes en borrador",
      statusCode: 409
    });
    expect(deliveryNoteRepository.delete).not.toHaveBeenCalled();
  });

  it("deletes draft delivery notes", async () => {
    const useCase = new DeleteDeliveryNoteUseCase(deliveryNoteRepository);

    await useCase.execute("note-draft");

    expect(deliveryNoteRepository.delete).toHaveBeenCalledWith("note-draft");
    expect(await deliveryNoteRepository.findById("note-draft")).toBeNull();
  });

  it("updates status for an existing delivery note", async () => {
    const useCase = new ChangeDeliveryNoteStatusUseCase(deliveryNoteRepository);

    const result = await useCase.execute("note-pending", "REVIEWED");

    expect(deliveryNoteRepository.updateStatus).toHaveBeenCalledWith("note-pending", "REVIEWED");
    expect(result.status).toBe("REVIEWED");
  });

  it("throws when fetching an unknown delivery note", async () => {
    const useCase = new GetDeliveryNoteUseCase(deliveryNoteRepository);

    await expect(useCase.execute("missing")).rejects.toMatchObject({
      message: "Albarán no encontrado",
      statusCode: 404
    });
  });

  it("filters delivery notes by status", async () => {
    const useCase = new GetDeliveryNotesUseCase(deliveryNoteRepository);

    const result = await useCase.execute({ status: "PENDING" });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("note-pending");
  });

  it("filters delivery notes by a selected date", async () => {
    const useCase = new GetDeliveryNotesUseCase(deliveryNoteRepository);

    const result = await useCase.execute({
      date: new Date("2026-01-02T00:00:00.000Z")
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("note-pending");
  });

  it("builds the dashboard summary with totals and counters", async () => {
    const todayIso = new Date().toISOString();
    deliveryNoteRepository.notes = [
      buildNote("note-draft", "DRAFT", todayIso),
      buildNote("note-reviewed", "REVIEWED", todayIso),
      buildNote("note-pending", "PENDING", todayIso)
    ];

    const useCase = new GetDashboardSummaryUseCase(deliveryNoteRepository);

    const result = await useCase.execute();

    expect(result.stats.totalNotes).toBe(3);
    expect(result.stats.reviewed).toBe(1);
    expect(result.stats.pending).toBe(1);
    expect(result.stats.totalPieces).toBe(8);
    expect(result.stats.totalAmount).toBe(210);
  });
});
