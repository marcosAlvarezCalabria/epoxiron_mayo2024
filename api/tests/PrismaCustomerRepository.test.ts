import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  customer: {
    create: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("../src/infrastructure/prisma/client.js", () => ({
  prisma: prismaMock
}));

import { PrismaCustomerRepository } from "../src/infrastructure/repositories/PrismaCustomerRepository.js";

const fiscalInput = {
  name: "Taller Norte",
  vat: "B12345678",
  legalName: "Taller Norte SL",
  fiscalStreet: "Calle Mayor 1",
  fiscalStreet2: "Nave 2",
  fiscalCity: "Madrid",
  fiscalZip: "28001",
  fiscalProvince: "Madrid",
  fiscalCountryCode: "ES",
  paymentTermCode: "30D",
  pricePerLinearMeter: 10,
  pricePerSquareMeter: 20,
  minimumRate: 5,
  specialPieces: []
};

describe("PrismaCustomerRepository fiscal mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.customer.create.mockResolvedValue({ id: "customer-1", ...fiscalInput });
    prismaMock.customer.update.mockResolvedValue({ id: "customer-1", ...fiscalInput });
  });

  it("serializes fiscal fields on create", async () => {
    const repository = new PrismaCustomerRepository();

    await repository.create(fiscalInput);

    expect(prismaMock.customer.create).toHaveBeenCalledWith({
      data: {
        ...fiscalInput,
        specialPieces: { create: [] }
      },
      include: { specialPieces: true }
    });
  });

  it("serializes fiscal fields on update", async () => {
    const repository = new PrismaCustomerRepository();

    await repository.update("customer-1", fiscalInput);

    expect(prismaMock.customer.update).toHaveBeenCalledWith({
      where: { id: "customer-1" },
      data: {
        ...fiscalInput,
        specialPieces: {
          deleteMany: {},
          create: []
        }
      },
      include: { specialPieces: true }
    });
  });
});
