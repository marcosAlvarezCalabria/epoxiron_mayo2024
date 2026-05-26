import type { Customer } from "../../domain/entities/Customer.js";
import type {
  DeliveryNote,
  DeliveryNoteFilters,
  DeliveryNoteInput,
  DeliveryNoteItem,
  DeliveryNoteItemDraft,
  DeliveryNoteStatus
} from "../../domain/entities/DeliveryNote.js";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { CustomerRepository } from "../../domain/repositories/CustomerRepository.js";
import type { DeliveryNoteRepository } from "../../domain/repositories/DeliveryNoteRepository.js";

export interface PriceCalculationResult {
  unitPrice: number;
  totalPrice: number;
}

export class CalculatePriceUseCase {
  public execute(item: DeliveryNoteItemDraft, customer: Customer): PriceCalculationResult {
    const quantity = item.quantity;
    const specialPiece = customer.specialPieces.find(
      (entry) => entry.name.toLowerCase() === item.description.toLowerCase()
    );

    let totalPrice = 0;

    if (specialPiece) {
      totalPrice = specialPiece.price * quantity;
    } else if (item.linearMeters) {
      totalPrice = item.linearMeters * customer.pricePerLinearMeter * quantity;
    } else if (item.squareMeters) {
      totalPrice = item.squareMeters * customer.pricePerSquareMeter * quantity;
    }

    const minimum = customer.minimumRate * quantity;
    if (totalPrice < minimum) {
      totalPrice = minimum;
    }

    if (
      item.thickness &&
      customer.grosorMm &&
      customer.grosorPrecio &&
      item.thickness >= customer.grosorMm
    ) {
      totalPrice += customer.grosorPrecio * quantity;
    }

    totalPrice = Math.round(totalPrice * 100) / 100;

    return {
      unitPrice: Math.round((totalPrice / quantity) * 100) / 100,
      totalPrice
    };
  }
}

const materializeItems = (
  customer: Customer,
  items: DeliveryNoteItemDraft[],
  calculatePrice: CalculatePriceUseCase
): DeliveryNoteItem[] => {
  return items.map((item) => {
    const pricing = calculatePrice.execute(item, customer);

    return {
      ...item,
      unitPrice: pricing.unitPrice,
      totalPrice: pricing.totalPrice
    };
  });
};

const sumTotalAmount = (items: DeliveryNoteItem[]): number =>
  Math.round(items.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;

const buildDeliveryNoteNumber = async (
  repository: DeliveryNoteRepository,
  date: Date
): Promise<string> => {
  const year = date.getFullYear();
  const latestNumber = await repository.findLatestNumberForYear(year);
  const lastSequence = latestNumber
    ? Number.parseInt(latestNumber.split("-").at(-1) ?? "0", 10)
    : 0;

  return `ALB-${year}-${(lastSequence + 1).toString().padStart(4, "0")}`;
};

export class CreateDeliveryNoteUseCase {
  public constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly deliveryNoteRepository: DeliveryNoteRepository,
    private readonly calculatePriceUseCase: CalculatePriceUseCase
  ) {}

  public async execute(input: DeliveryNoteInput) {
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) {
      throw new DomainException("Cliente no encontrado", 404);
    }

    const date = input.date ?? new Date();
    const number = await buildDeliveryNoteNumber(this.deliveryNoteRepository, date);
    const items = materializeItems(customer, input.items, this.calculatePriceUseCase);
    return this.deliveryNoteRepository.create({
      ...input,
      date,
      number,
      customerName: customer.name,
      items,
      totalAmount: sumTotalAmount(items)
    });
  }
}

export class UpdateDeliveryNoteUseCase {
  public constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly deliveryNoteRepository: DeliveryNoteRepository,
    private readonly calculatePriceUseCase: CalculatePriceUseCase
  ) {}

  public async execute(id: string, input: DeliveryNoteInput) {
    const existing = await this.deliveryNoteRepository.findById(id);
    if (!existing) {
      throw new DomainException("Albarán no encontrado", 404);
    }

    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) {
      throw new DomainException("Cliente no encontrado", 404);
    }

    const items = materializeItems(customer, input.items, this.calculatePriceUseCase);
    return this.deliveryNoteRepository.update(id, {
      ...input,
      number: existing.number,
      date: input.date ?? existing.date,
      customerName: customer.name,
      items,
      totalAmount: sumTotalAmount(items)
    });
  }
}

export class DeleteDeliveryNoteUseCase {
  public constructor(private readonly repository: DeliveryNoteRepository) {}

  public async execute(id: string) {
    const deliveryNote = await this.repository.findById(id);
    if (!deliveryNote) {
      throw new DomainException("Albarán no encontrado", 404);
    }

    if (deliveryNote.status !== "DRAFT") {
      throw new DomainException("Solo se pueden eliminar albaranes en borrador", 409);
    }

    await this.repository.delete(id);
  }
}

export class GetDeliveryNotesUseCase {
  public constructor(private readonly repository: DeliveryNoteRepository) {}

  public async execute(filters: DeliveryNoteFilters) {
    return this.repository.findAll(filters);
  }
}

export class GetDeliveryNoteUseCase {
  public constructor(private readonly repository: DeliveryNoteRepository) {}

  public async execute(id: string) {
    const deliveryNote = await this.repository.findById(id);
    if (!deliveryNote) {
      throw new DomainException("Albarán no encontrado", 404);
    }

    return deliveryNote;
  }
}

export class ChangeDeliveryNoteStatusUseCase {
  public constructor(private readonly repository: DeliveryNoteRepository) {}

  public async execute(id: string, status: DeliveryNoteStatus) {
    const deliveryNote = await this.repository.findById(id);
    if (!deliveryNote) {
      throw new DomainException("Albarán no encontrado", 404);
    }

    return this.repository.updateStatus(id, status);
  }
}

export class GetDashboardSummaryUseCase {
  public constructor(private readonly repository: DeliveryNoteRepository) {}

  public async execute() {
    const notes = await this.repository.findAll({ today: true });
    const totalAmount = notes.reduce((sum, note) => sum + note.totalAmount, 0);
    const totalPieces = notes.reduce((sum, note) => sum + note.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const reviewed = notes.filter((note) => note.status === "REVIEWED").length;

    return {
      notes,
      stats: {
        totalNotes: notes.length,
        totalPieces,
        totalAmount: Math.round(totalAmount * 100) / 100,
        reviewed,
        pending: notes.filter((note) => note.status === "PENDING").length
      }
    };
  }
}
