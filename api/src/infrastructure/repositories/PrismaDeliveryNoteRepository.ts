import type {
  DeliveryNote,
  DeliveryNoteFilters,
  DeliveryNoteItem,
  DeliveryNoteTexture,
  DeliveryNoteStatus
} from "../../domain/entities/DeliveryNote.js";
import type { DeliveryNoteRepository } from "../../domain/repositories/DeliveryNoteRepository.js";
import { prisma } from "../prisma/client.js";

const buildWhere = (filters: DeliveryNoteFilters) => {
  const referenceDate = filters.date ?? new Date();
  const start = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const end = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() + 1
  );

  return {
    status: filters.status,
    customerId: filters.customerId,
    date: filters.today || filters.date
      ? {
          gte: start,
          lt: end
        }
      : undefined
  };
};

const resolveTexture = (value: unknown): DeliveryNoteTexture => {
  if (value === "MATE" || value === "TEXTURADO" || value === "GOFRADO") {
    return value;
  }

  return "NORMAL";
};

const toDomainItem = (
  item: {
    id: string;
    description: string;
    color: string;
    linearMeters: number | null;
    squareMeters: number | null;
    thickness: number | null;
    primer: boolean;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  } & { texture?: unknown }
): DeliveryNoteItem => ({
  id: item.id,
  description: item.description,
  color: item.color,
  texture: resolveTexture(item.texture),
  linearMeters: item.linearMeters,
  squareMeters: item.squareMeters,
  thickness: item.thickness,
  primer: item.primer,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  totalPrice: item.totalPrice
});

const toDomainNote = (
  note: {
    id: string;
    number: string;
    customerId: string;
    customerName: string;
    status: DeliveryNoteStatus;
    notes: string | null;
    totalAmount: number;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
    items: Array<
      {
        id: string;
        description: string;
        color: string;
        linearMeters: number | null;
        squareMeters: number | null;
        thickness: number | null;
        primer: boolean;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      } & { texture?: unknown }
    >;
  }
): DeliveryNote => ({
  ...note,
  items: note.items.map(toDomainItem)
});

export class PrismaDeliveryNoteRepository implements DeliveryNoteRepository {
  public async findAll(filters: DeliveryNoteFilters) {
    const notes = await prisma.deliveryNote.findMany({
      where: buildWhere(filters),
      take: filters.limit,
      skip: filters.offset,
      include: {
        items: true
      },
      orderBy: {
        date: "desc"
      }
    });

    return notes.map(toDomainNote);
  }

  public async count(filters: DeliveryNoteFilters) {
    return prisma.deliveryNote.count({
      where: buildWhere(filters)
    });
  }

  public async findById(id: string) {
    const note = await prisma.deliveryNote.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    return note ? toDomainNote(note) : null;
  }

  public async findLatestNumberForYear(year: number) {
    const latest = await prisma.deliveryNote.findFirst({
      where: {
        number: {
          startsWith: `ALB-${year}-`
        }
      },
      orderBy: {
        number: "desc"
      }
    });

    return latest?.number ?? null;
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
    const note = await prisma.deliveryNote.create({
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

    return toDomainNote(note);
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
    const note = await prisma.deliveryNote.update({
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

    return toDomainNote(note);
  }

  public async delete(id: string) {
    await prisma.deliveryNote.delete({
      where: { id }
    });
  }

  public async updateStatus(id: string, status: DeliveryNoteStatus) {
    const note = await prisma.deliveryNote.update({
      where: { id },
      data: { status },
      include: {
        items: true
      }
    });

    return toDomainNote(note);
  }
}
