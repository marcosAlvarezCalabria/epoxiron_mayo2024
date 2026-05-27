import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer, CustomerInput } from "../src/domain/entities/Customer.js";
import {
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  GetCustomersUseCase,
  UpdateCustomerUseCase
} from "../src/application/use-cases/customers.js";

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

  public async create(input: CustomerInput) {
    const created: Customer = {
      id: crypto.randomUUID(),
      ...input,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
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
      buildCustomer("customer-1", "Pinturas Lopez"),
      buildCustomer("customer-2", "Recubrimientos Norte")
    ];
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
});
