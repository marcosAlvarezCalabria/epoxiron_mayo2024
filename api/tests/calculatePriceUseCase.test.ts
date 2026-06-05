import { describe, expect, it } from "vitest";
import { CalculatePriceUseCase } from "../src/application/use-cases/deliveryNotes.js";
import type { Customer } from "../src/domain/entities/Customer.js";

const customer: Customer = {
  id: "customer-1",
  name: "Cliente",
  email: null,
  phone: null,
  address: null,
  notes: null,
  pricePerLinearMeter: 10,
  pricePerSquareMeter: 20,
  minimumRate: 15,
  grosorPrecio: 5,
  specialPieces: [{ name: "Barandilla", price: 40 }],
  createdAt: new Date(),
  updatedAt: new Date()
};

describe("CalculatePriceUseCase", () => {
  const useCase = new CalculatePriceUseCase();

  it("prioritizes special piece price", () => {
    const result = useCase.execute(
      {
        description: "barandilla",
        color: "RAL 9005",
        texture: "NORMAL",
        quantity: 2
      },
      customer
    );

    expect(result.totalPrice).toBe(80);
    expect(result.unitPrice).toBe(40);
  });

  it("duplicates the calculated price when thickness is informed", () => {
    const result = useCase.execute(
      {
        description: "Perfil",
        color: "RAL 7016",
        linearMeters: 1,
        texture: "NORMAL",
        thickness: 4,
        quantity: 1
      },
      customer
    );

    expect(result.totalPrice).toBe(30);
    expect(result.unitPrice).toBe(30);
  });

  it("duplicates the calculated price when primer is informed", () => {
    const result = useCase.execute(
      {
        description: "Perfil",
        color: "RAL 7016",
        linearMeters: 1,
        primer: true,
        texture: "NORMAL",
        quantity: 1
      },
      customer
    );

    expect(result.totalPrice).toBe(30);
    expect(result.unitPrice).toBe(30);
  });

  it("adds linear meters and square meters in the same item", () => {
    const result = useCase.execute(
      {
        description: "Perfil mixto",
        color: "RAL 9005",
        linearMeters: 2,
        squareMeters: 1.5,
        texture: "NORMAL",
        quantity: 2
      },
      customer
    );

    expect(result.totalPrice).toBe(100);
    expect(result.unitPrice).toBe(50);
  });
});
