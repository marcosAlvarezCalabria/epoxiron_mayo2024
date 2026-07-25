import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer, CustomerInput } from "../src/domain/entities/Customer.js";
import {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  GetCustomersUseCase,
  normalizeCustomerInput,
  UpdateCustomerUseCase
} from "../src/application/use-cases/customers.js";
import { validateFiscalCustomer } from "../src/domain/entities/Customer.js";

class InMemoryCustomerRepository {
  public customers: Customer[] = [];
  public deliveryNotesByCustomerId = new Set<string>();
  public delete = vi.fn(async (id: string) => {
    this.customers = this.customers.filter((customer) => customer.id !== id);
  });
  public update = vi.fn(async (id: string, input: CustomerInput) => {
    const current = this.customers.find((customer) => customer.id === id)!;
    const updated: Customer = {
      ...current,
      ...input,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      vat: input.vat ?? null,
      legalName: input.legalName ?? null,
      fiscalStreet: input.fiscalStreet ?? null,
      fiscalStreet2: input.fiscalStreet2 ?? null,
      fiscalCity: input.fiscalCity ?? null,
      fiscalZip: input.fiscalZip ?? null,
      fiscalProvince: input.fiscalProvince ?? null,
      fiscalCountryCode:
        input.fiscalCountryCode === undefined ? current.fiscalCountryCode : input.fiscalCountryCode,
      paymentTermCode: input.paymentTermCode ?? null,
      externalPartnerId: input.externalPartnerId ?? current.externalPartnerId,
      grosorPrecio: input.grosorPrecio ?? null,
      updatedAt: new Date()
    };
    this.customers = this.customers.map((customer) => (customer.id === id ? updated : customer));
    return updated;
  });

  public async findAll(search?: string) {
    if (!search) {
      return this.customers;
    }

    return this.customers.filter((customer) =>
      customer.name.toLowerCase().includes(search.toLowerCase())
    );
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

  public async create(input: CustomerInput) {
    const created: Customer = {
      id: crypto.randomUUID(),
      ...input,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      vat: input.vat ?? null,
      legalName: input.legalName ?? null,
      fiscalStreet: input.fiscalStreet ?? null,
      fiscalStreet2: input.fiscalStreet2 ?? null,
      fiscalCity: input.fiscalCity ?? null,
      fiscalZip: input.fiscalZip ?? null,
      fiscalProvince: input.fiscalProvince ?? null,
      fiscalCountryCode: input.fiscalCountryCode ?? "ES",
      paymentTermCode: input.paymentTermCode ?? null,
      externalPartnerId: input.externalPartnerId ?? null,
      grosorPrecio: input.grosorPrecio ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.customers.push(created);
    return created;
  }

  public async hasDeliveryNotes(id: string) {
    return this.deliveryNotesByCustomerId.has(id);
  }
}

const buildCustomer = (id: string, name: string): Customer => ({
  id,
  name,
  email: null,
  phone: null,
  address: null,
  notes: null,
  vat: null,
  legalName: null,
  fiscalStreet: null,
  fiscalStreet2: null,
  fiscalCity: null,
  fiscalZip: null,
  fiscalProvince: null,
  fiscalCountryCode: null,
  paymentTermCode: null,
  externalPartnerId: null,
  pricePerLinearMeter: 10,
  pricePerSquareMeter: 20,
  minimumRate: 15,
  grosorPrecio: 5,
  specialPieces: [],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z")
});

describe("customer use cases", () => {
  let repository: InMemoryCustomerRepository;

  beforeEach(() => {
    repository = new InMemoryCustomerRepository();
    repository.customers = [
      { ...buildCustomer("customer-1", "Pinturas Lopez"), email: "lopez@example.com" },
      { ...buildCustomer("customer-2", "Recubrimientos Norte"), email: "norte@example.com" }
    ];
  });

  it("blocks creating a customer with a duplicated name", async () => {
    const useCase = new CreateCustomerUseCase(repository);

    await expect(
      useCase.execute({
        name: "pinturas lopez",
        email: "nuevo@example.com",
        pricePerLinearMeter: 10,
        pricePerSquareMeter: 20,
        minimumRate: 15,
        grosorPrecio: 5,
        specialPieces: []
      })
    ).rejects.toMatchObject({
      message: "Ya existe un cliente con ese nombre",
      statusCode: 409
    });
  });

  it("blocks creating a customer with a duplicated email", async () => {
    const useCase = new CreateCustomerUseCase(repository);

    await expect(
      useCase.execute({
        name: "Cliente Nuevo",
        email: "LOPEZ@example.com",
        pricePerLinearMeter: 10,
        pricePerSquareMeter: 20,
        minimumRate: 15,
        grosorPrecio: 5,
        specialPieces: []
      })
    ).rejects.toMatchObject({
      message: "Ya existe un cliente con ese correo",
      statusCode: 409
    });
  });

  it("blocks creating a customer with duplicated special piece names", async () => {
    const useCase = new CreateCustomerUseCase(repository);

    await expect(
      useCase.execute({
        name: "Cliente Nuevo",
        email: "nuevo@example.com",
        pricePerLinearMeter: 10,
        pricePerSquareMeter: 20,
        minimumRate: 15,
        grosorPrecio: 5,
        specialPieces: [
          { name: "Puerta peatonal", price: 40 },
          { name: " puerta peatonal ", price: 55 }
        ]
      })
    ).rejects.toMatchObject({
      message: "No puede haber piezas especiales con el mismo nombre para un cliente",
      statusCode: 409
    });
  });

  it("filters customers by search term", async () => {
    const useCase = new GetCustomersUseCase(repository);

    const result = await useCase.execute("lopez");

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("customer-1");
  });

  it("throws when getting an unknown customer", async () => {
    const useCase = new GetCustomerUseCase(repository);

    await expect(useCase.execute("missing")).rejects.toMatchObject({
      message: "Cliente no encontrado",
      statusCode: 404
    });
  });

  it("updates an existing customer", async () => {
    const useCase = new UpdateCustomerUseCase(repository);

    const result = await useCase.execute("customer-1", {
      name: "Pinturas Lopez Premium",
      pricePerLinearMeter: 12,
      pricePerSquareMeter: 22,
      minimumRate: 18,
      grosorPrecio: 6,
      specialPieces: [{ name: "Barandilla", price: 40 }]
    });

    expect(result.name).toBe("Pinturas Lopez Premium");
    expect(repository.update).toHaveBeenCalledOnce();
    expect(result.specialPieces).toHaveLength(1);
  });

  it("blocks updating a customer with a duplicated name", async () => {
    const useCase = new UpdateCustomerUseCase(repository);

    await expect(
      useCase.execute("customer-1", {
        name: "Recubrimientos Norte",
        email: "otro@example.com",
        pricePerLinearMeter: 12,
        pricePerSquareMeter: 22,
        minimumRate: 18,
        grosorPrecio: 6,
        specialPieces: []
      })
    ).rejects.toMatchObject({
      message: "Ya existe un cliente con ese nombre",
      statusCode: 409
    });
  });

  it("blocks updating a customer with duplicated special piece names", async () => {
    const useCase = new UpdateCustomerUseCase(repository);

    await expect(
      useCase.execute("customer-1", {
        name: "Pinturas Lopez",
        email: "lopez@example.com",
        pricePerLinearMeter: 12,
        pricePerSquareMeter: 22,
        minimumRate: 18,
        grosorPrecio: 6,
        specialPieces: [
          { name: "Marco soldado", price: 25 },
          { name: "marco soldado", price: 35 }
        ]
      })
    ).rejects.toMatchObject({
      message: "No puede haber piezas especiales con el mismo nombre para un cliente",
      statusCode: 409
    });
  });

  it("blocks deleting a customer with delivery notes", async () => {
    const useCase = new DeleteCustomerUseCase(repository);
    repository.deliveryNotesByCustomerId.add("customer-1");

    await expect(useCase.execute("customer-1")).rejects.toMatchObject({
      message: "No se puede eliminar un cliente con albaranes asociados",
      statusCode: 409
    });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("deletes a customer without delivery notes", async () => {
    const useCase = new DeleteCustomerUseCase(repository);

    await useCase.execute("customer-2");

    expect(repository.delete).toHaveBeenCalledWith("customer-2");
    expect(repository.customers.find((customer) => customer.id === "customer-2")).toBeUndefined();
  });

  it("keeps a historical customer without fiscal data readable and editable", async () => {
    const getUseCase = new GetCustomerUseCase(repository);
    const updateUseCase = new UpdateCustomerUseCase(repository);

    expect((await getUseCase.execute("customer-1")).vat).toBeNull();

    const updated = await updateUseCase.execute("customer-1", {
      name: "Pinturas Lopez",
      pricePerLinearMeter: 10,
      pricePerSquareMeter: 20,
      minimumRate: 15,
      grosorPrecio: 5,
      specialPieces: []
    });

    expect(updated.vat).toBeNull();
    expect(updated.fiscalCountryCode).toBeNull();
  });

  it("normalizes VAT, country and optional fiscal text", () => {
    const normalized = normalizeCustomerInput({
      name: "  Taller Norte  ",
      vat: "  b12345678  ",
      legalName: "  Taller Norte SL  ",
      fiscalCountryCode: " es ",
      fiscalStreet2: "   ",
      pricePerLinearMeter: 10,
      pricePerSquareMeter: 20,
      minimumRate: 15,
      specialPieces: []
    });

    expect(normalized).toMatchObject({
      name: "Taller Norte",
      vat: "B12345678",
      legalName: "Taller Norte SL",
      fiscalCountryCode: "ES",
      fiscalStreet2: null
    });
  });

  it("reports every missing fiscal field without persisting a completeness flag", () => {
    expect(validateFiscalCustomer(buildCustomer("customer-3", "Cliente histórico"))).toEqual([
      "MISSING_LEGAL_NAME",
      "MISSING_VAT",
      "MISSING_STREET",
      "MISSING_CITY",
      "MISSING_ZIP",
      "MISSING_COUNTRY"
    ]);
  });

  it("accepts a complete fiscal customer", () => {
    const customer: Customer = {
      ...buildCustomer("customer-3", "Cliente fiscal"),
      legalName: "Cliente Fiscal SL",
      vat: "B12345678",
      fiscalStreet: "Calle Mayor 1",
      fiscalCity: "Madrid",
      fiscalZip: "28001",
      fiscalCountryCode: "ES"
    };

    expect(validateFiscalCustomer(customer)).toEqual([]);
  });
});
