import type { CustomerInput } from "../../domain/entities/Customer.js";
import type { CustomerRepository } from "../../domain/repositories/CustomerRepository.js";
import { prisma } from "../prisma/client.js";

export class PrismaCustomerRepository implements CustomerRepository {
  public async findAll(search?: string) {
    return prisma.customer.findMany({
      where: search
        ? {
            name: {
              contains: search,
              mode: "insensitive"
            }
          }
        : undefined,
      include: {
        specialPieces: true
      },
      orderBy: {
        name: "asc"
      }
    });
  }

  public async findById(id: string) {
    return prisma.customer.findUnique({
      where: { id },
      include: {
        specialPieces: true
      }
    });
  }

  public async findByName(name: string) {
    return prisma.customer.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive"
        }
      },
      include: {
        specialPieces: true
      }
    });
  }

  public async findByEmail(email: string) {
    return prisma.customer.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive"
        }
      },
      include: {
        specialPieces: true
      }
    });
  }

  public async create(input: CustomerInput) {
    return prisma.customer.create({
      data: {
        ...input,
        specialPieces: {
          create: input.specialPieces
        }
      },
      include: {
        specialPieces: true
      }
    });
  }

  public async update(id: string, input: CustomerInput) {
    return prisma.customer.update({
      where: { id },
      data: {
        ...input,
        specialPieces: {
          deleteMany: {},
          create: input.specialPieces
        }
      },
      include: {
        specialPieces: true
      }
    });
  }

  public async delete(id: string) {
    await prisma.customer.delete({
      where: { id }
    });
  }

  public async hasDeliveryNotes(id: string) {
    const count = await prisma.deliveryNote.count({
      where: { customerId: id }
    });

    return count > 0;
  }
}
