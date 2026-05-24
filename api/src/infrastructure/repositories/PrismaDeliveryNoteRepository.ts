import type {
  DeliveryNote,
  DeliveryNoteFilters,
  DeliveryNoteStatus
} from "../../domain/entities/DeliveryNote.js";
import type { DeliveryNoteRepository } from "../../domain/repositories/DeliveryNoteRepository.js";
import { prisma } from "../prisma/client.js";

const buildWhere = (filters: DeliveryNoteFilters) => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  return {
    status: filters.status,
    customerId: filters.customerId,
    date: filters.today
      ? {
          gte: start,
          lt: end
        }
      : undefined
  };
};

export class PrismaDeliveryNoteRepository implements DeliveryNoteRepository {
  public async findAll(filters: DeliveryNoteFilters) {
    return prisma.deliveryNote.findMany({
      where: buildWhere(filters),
      include: {
        items: true
      },
      orderBy: {
        date: "desc"
      }
    });
  }

  public async findById(id: string) {
    return prisma.deliveryNote.findUnique({
      where: { id },
      include: {
        items: true
      }
    });
  }

  public async create(input: {
    customerId: string;
    customerName: string;
    date?: Date;
    items: DeliveryNote["items"];
    notes?: string | null;
    number: string;
    status: DeliveryNoteStatus;
    totalAmount: number;
  }) {
    return prisma.deliveryNote.create({
      data: {
        ...input,
        date: input.date ?? new Date(),
        items: {
          create: input.items
        }
      },
      include: {
        items: true
      }
    });
  }

  public async update(
    id: string,
    input: {
      customerId: string;
      customerName: string;
      date?: Date;
      items: DeliveryNote["items"];
      notes?: string | null;
      number: string;
      status: DeliveryNoteStatus;
      totalAmount: number;
    }
  ) {
    return prisma.deliveryNote.update({
      where: { id },
      data: {
        ...input,
        date: input.date ?? new Date(),
        items: {
          deleteMany: {},
          create: input.items
        }
      },
      include: {
        items: true
      }
    });
  }

  public async delete(id: string) {
    await prisma.deliveryNote.delete({
      where: { id }
    });
  }

  public async updateStatus(id: string, status: DeliveryNoteStatus) {
    return prisma.deliveryNote.update({
      where: { id },
      data: { status },
      include: {
        items: true
      }
    });
  }
}
