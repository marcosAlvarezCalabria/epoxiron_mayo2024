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
import type { DailyDeliveryNotesReportGenerator } from "../../domain/services/DailyDeliveryNotesReportGenerator.js";
import type { EmailSender } from "../../domain/services/EmailSender.js";

export interface PriceCalculationResult {
  unitPrice: number;
  totalPrice: number;
}

const toCustomerInput = (customer: Customer) => ({
  name: customer.name,
  email: customer.email,
  phone: customer.phone,
  address: customer.address,
  notes: customer.notes,
  pricePerLinearMeter: customer.pricePerLinearMeter,
  pricePerSquareMeter: customer.pricePerSquareMeter,
  minimumRate: customer.minimumRate,
  grosorPrecio: customer.grosorPrecio,
  specialPieces: customer.specialPieces.map((piece) => ({
    name: piece.name,
    price: piece.price
  }))
});

export class CalculatePriceUseCase {
  public execute(item: DeliveryNoteItemDraft, customer: Customer): PriceCalculationResult {
    const quantity = item.quantity;
    const specialPiece = customer.specialPieces.find(
      (entry) => entry.name.toLowerCase() === item.description.toLowerCase()
    );

    let totalPrice = 0;

    if (specialPiece) {
      totalPrice = specialPiece.price * quantity;
    } else {
      const pricePerPiece =
        (item.linearMeters ?? 0) * customer.pricePerLinearMeter +
        (item.squareMeters ?? 0) * customer.pricePerSquareMeter;

      totalPrice = pricePerPiece * quantity;
    }

    const minimum = customer.minimumRate * quantity;
    if (totalPrice < minimum) {
      totalPrice = minimum;
    }

    if (item.thickness) {
      totalPrice *= 2;
    }

    if (item.primer) {
      totalPrice *= 2;
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
    const { saveAsSpecialPiece: _saveAsSpecialPiece, ...persistedItem } = item;

    return {
      ...persistedItem,
      texture: item.texture ?? "NORMAL",
      unitPrice: pricing.unitPrice,
      totalPrice: pricing.totalPrice
    };
  });
};

const sumTotalAmount = (items: DeliveryNoteItem[]): number =>
  Math.round(items.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;

const syncCustomerSpecialPieces = async (
  customer: Customer,
  items: DeliveryNoteItemDraft[],
  pricedItems: DeliveryNoteItem[],
  customerRepository: CustomerRepository
) => {
  const existingNames = new Set(customer.specialPieces.map((piece) => piece.name.trim().toLowerCase()));
  const specialPiecesToAdd: { name: string; price: number }[] = [];

  items.forEach((item, index) => {
    if (!item.saveAsSpecialPiece) {
      return;
    }

    const normalizedName = item.description.trim().toLowerCase();
    if (!normalizedName || existingNames.has(normalizedName)) {
      return;
    }

    existingNames.add(normalizedName);
    specialPiecesToAdd.push({
      name: item.description.trim(),
      price: pricedItems[index]?.unitPrice ?? 0
    });
  });

  if (specialPiecesToAdd.length === 0) {
    return customer;
  }

  return customerRepository.update(customer.id, {
    ...toCustomerInput(customer),
    specialPieces: [...toCustomerInput(customer).specialPieces, ...specialPiecesToAdd]
  });
};

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
    const pricedItems = materializeItems(customer, input.items, this.calculatePriceUseCase);
    const customerWithSpecialPieces = await syncCustomerSpecialPieces(
      customer,
      input.items,
      pricedItems,
      this.customerRepository
    );
    const items = materializeItems(
      customerWithSpecialPieces,
      input.items,
      this.calculatePriceUseCase
    );
    return this.deliveryNoteRepository.create({
      ...input,
      date,
      number,
      customerName: customerWithSpecialPieces.name,
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

    const pricedItems = materializeItems(customer, input.items, this.calculatePriceUseCase);
    const customerWithSpecialPieces = await syncCustomerSpecialPieces(
      customer,
      input.items,
      pricedItems,
      this.customerRepository
    );
    const items = materializeItems(
      customerWithSpecialPieces,
      input.items,
      this.calculatePriceUseCase
    );
    return this.deliveryNoteRepository.update(id, {
      ...input,
      number: existing.number,
      date: input.date ?? existing.date,
      customerName: customerWithSpecialPieces.name,
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

  public async count(filters: DeliveryNoteFilters) {
    return this.repository.count(filters);
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

const buildDailyReportSubject = (date: Date) => {
  const formattedDate = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
  return `Albaranes del dia ${formattedDate}`;
};

export class SendDailyDeliveryNotesReportUseCase {
  public constructor(
    private readonly repository: DeliveryNoteRepository,
    private readonly reportGenerator: DailyDeliveryNotesReportGenerator | null,
    private readonly emailSender: EmailSender | null,
    private readonly defaultRecipientEmail?: string
  ) {}

  public async execute(input: { date?: Date; email?: string | null }) {
    if (!this.reportGenerator || !this.emailSender) {
      throw new DomainException("El envio por correo no esta configurado", 503);
    }

    const date = input.date ?? new Date();
    const recipientEmail = input.email?.trim() || this.defaultRecipientEmail || null;

    if (!recipientEmail) {
      throw new DomainException("Indica un correo de destino", 400);
    }

    const notes = await this.repository.findAll({ date });

    if (notes.length === 0) {
      throw new DomainException("No hay albaranes para la fecha seleccionada", 404);
    }

    const attachment = await this.reportGenerator.generate({ date, notes });
    const totalAmount = Math.round(notes.reduce((sum, note) => sum + note.totalAmount, 0) * 100) / 100;

    await this.emailSender.send({
      attachments: [attachment],
      subject: buildDailyReportSubject(date),
      text: [
        "Adjuntamos el PDF con los albaranes del dia.",
        "",
        `Fecha: ${date.toISOString().slice(0, 10)}`,
        `Albaranes: ${notes.length}`,
        `Importe total: ${totalAmount.toFixed(2)} EUR`
      ].join("\n"),
      to: recipientEmail
    });

    return {
      date,
      email: recipientEmail,
      notesCount: notes.length
    };
  }
}
