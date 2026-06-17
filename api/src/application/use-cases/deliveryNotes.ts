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
import type { IEmailNotifier } from "../../domain/ports/IEmailNotifier.js";
import type { DailyDeliveryNotesReportUploadRepository } from "../../domain/repositories/DailyDeliveryNotesReportUploadRepository.js";
import type { DeliveryNoteRepository } from "../../domain/repositories/DeliveryNoteRepository.js";
import type {
  DailyDeliveryNotesReportGenerator,
  DeliveryNoteReportCustomerDetails
} from "../../domain/services/DailyDeliveryNotesReportGenerator.js";
import type {
  DailyDeliveryNotesReportUploader
} from "../../domain/services/DailyDeliveryNotesReportUploader.js";

export interface PriceCalculationResult {
  unitPrice: number;
  totalPrice: number;
}

const normalizeSpecialPieceName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[+/_-]+/g, " ")
    .replace(/\bmas\b/g, " ")
    .replace(/\bk/g, "c")
    .replace(
      /\b(?:pieza|especial|incluir|incluye|incluida|incluido|guardar|como|pon|poner|mete|meter)\b/g,
      " "
    )
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, "")
    .trim();

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
    const pricingMode = item.pricingMode ?? "DIMENSIONS";
    const normalizedDescription = normalizeSpecialPieceName(item.description);
    const specialPiece = customer.specialPieces.find(
      (entry) => {
        const normalizedEntryName = normalizeSpecialPieceName(entry.name);
        return normalizedEntryName === normalizedDescription;
      }
    );

    let totalPrice = 0;

    if (pricingMode === "UNIT" && item.customUnitPrice != null) {
      totalPrice = item.customUnitPrice * quantity;
    } else if (specialPiece) {
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
      pricingMode: item.pricingMode ?? "DIMENSIONS",
      customUnitPrice: item.customUnitPrice ?? null,
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
  const existingNames = new Set(customer.specialPieces.map((piece) => normalizeSpecialPieceName(piece.name)));
  const specialPiecesToAdd: { name: string; price: number }[] = [];

  items.forEach((item, index) => {
    if (!item.saveAsSpecialPiece) {
      return;
    }

    const normalizedName = normalizeSpecialPieceName(item.description);
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

const formatReportDate = (date: Date) => date.toISOString().slice(0, 10);

const resolveLatestUpdatedAt = (notes: DeliveryNote[]) =>
  notes.reduce((latest, note) => {
    if (!latest || note.updatedAt.getTime() > latest.getTime()) {
      return note.updatedAt;
    }

    return latest;
  }, null as Date | null);

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

export class GetDailyDeliveryNotesReportUploadsUseCase {
  public constructor(private readonly repository: DailyDeliveryNotesReportUploadRepository) {}

  public async execute(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }) {
    return this.repository.findAll(filters);
  }

  public async count(filters: {
    dateFrom?: Date;
    dateTo?: Date;
  }) {
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

export class SendDailyDeliveryNotesReportUseCase {
  public constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly repository: DeliveryNoteRepository,
    private readonly reportGenerator: DailyDeliveryNotesReportGenerator | null,
    private readonly uploader: DailyDeliveryNotesReportUploader | null,
    private readonly uploadRepository: DailyDeliveryNotesReportUploadRepository,
    private readonly emailNotifier: IEmailNotifier
  ) {}

  public async execute(input: { date?: Date }) {
    const date = input.date ?? new Date();
    const existingUpload = await this.uploadRepository.findByDate(date);

    const notes = await this.repository.findAll({ date });

    if (notes.length === 0) {
      if (existingUpload) {
        if (this.uploader) {
          try {
            await this.uploader.delete({ fileId: existingUpload.fileId });
          } catch (_error: unknown) {
            // El registro local sigue siendo la fuente de verdad; si el borrado remoto falla,
            // eliminamos igualmente el registro para no reutilizar un PDF obsoleto.
          }
        }

        await this.uploadRepository.deleteByDate(date);
      }

      throw new DomainException("No hay albaranes para la fecha seleccionada", 404);
    }

    const latestSourceUpdatedAt = resolveLatestUpdatedAt(notes);

    if (!latestSourceUpdatedAt) {
      throw new DomainException("No se pudo calcular el estado del informe diario", 500);
    }

    if (existingUpload) {
      const sourceUnchanged =
        existingUpload.lastSourceUpdatedAt.getTime() === latestSourceUpdatedAt.getTime();
      const fileStillExists = !this.uploader || await this.uploader.exists({ fileId: existingUpload.fileId });

      if (sourceUnchanged && fileStillExists) {
        return {
          date: existingUpload.reportDate,
          fileId: existingUpload.fileId,
          fileName: existingUpload.fileName,
          folderName: existingUpload.folderName,
          notesCount: existingUpload.notesCount,
          webViewLink: existingUpload.webViewLink
        };
      }
    }

    if (!this.reportGenerator || !this.uploader) {
      throw new DomainException("La subida del informe diario no esta configurada", 503);
    }

    const uniqueCustomerIds = [...new Set(notes.map((note) => note.customerId))];
    const customerEntries = await Promise.all(
      uniqueCustomerIds.map(async (customerId) => {
        const customer = await this.customerRepository.findById(customerId);
        const fallbackNote = notes.find((note) => note.customerId === customerId);
        const customerDetails: DeliveryNoteReportCustomerDetails = {
          name: customer?.name ?? fallbackNote?.customerName ?? "Cliente",
          email: customer?.email ?? null,
          phone: customer?.phone ?? null,
          address: customer?.address ?? null
        };

        return [customerId, customerDetails] as const;
      })
    );

    const customersById = Object.fromEntries(customerEntries);

    const attachment = await this.reportGenerator.generate({ date, notes, customersById });
    const upload = await this.uploader.upload({ attachment, date });
    const savedUpload = existingUpload
      ? await this.uploadRepository.updateByDate({
          reportDate: date,
          fileId: upload.fileId,
          fileName: upload.fileName,
          folderName: upload.folderName,
          notesCount: notes.length,
          webViewLink: upload.webViewLink,
          lastSourceUpdatedAt: latestSourceUpdatedAt
        })
      : await this.uploadRepository.create({
          reportDate: date,
          fileId: upload.fileId,
          fileName: upload.fileName,
          folderName: upload.folderName,
          notesCount: notes.length,
          webViewLink: upload.webViewLink,
          lastSourceUpdatedAt: latestSourceUpdatedAt
        });

    try {
      await this.emailNotifier.sendDailyReportNotification({
        date: formatReportDate(savedUpload.reportDate),
        notesCount: savedUpload.notesCount,
        fileName: savedUpload.fileName,
        webViewLink: savedUpload.webViewLink ?? savedUpload.fileId
      });
    } catch (error: unknown) {
      console.error("[EmailNotifier]", error);
    }

    return {
      date: savedUpload.reportDate,
      fileId: savedUpload.fileId,
      fileName: savedUpload.fileName,
      folderName: savedUpload.folderName,
      notesCount: savedUpload.notesCount,
      webViewLink: savedUpload.webViewLink
    };
  }
}

export interface BackfillDailyDeliveryNotesReportsResultItem {
  date: Date;
  notesCount: number;
  status: "dry-run" | "uploaded" | "failed";
  fileId: string | null;
  fileName: string | null;
  folderName: string | null;
  webViewLink: string | null;
  errorMessage: string | null;
}

export interface BackfillDailyDeliveryNotesReportsResult {
  from: Date;
  to: Date;
  dryRun: boolean;
  processedDates: number;
  uploadedDates: number;
  failedDates: number;
  totalNotes: number;
  items: BackfillDailyDeliveryNotesReportsResultItem[];
}

type DailyDeliveryNotesReportSender = Pick<SendDailyDeliveryNotesReportUseCase, "execute">;

export class BackfillDailyDeliveryNotesReportsUseCase {
  public constructor(
    private readonly repository: DeliveryNoteRepository,
    private readonly reportSender: DailyDeliveryNotesReportSender
  ) {}

  public async execute(input: {
    from: Date;
    to: Date;
    dryRun: boolean;
  }): Promise<BackfillDailyDeliveryNotesReportsResult> {
    const from = new Date(input.from.getFullYear(), input.from.getMonth(), input.from.getDate());
    const to = new Date(input.to.getFullYear(), input.to.getMonth(), input.to.getDate());

    if (from.getTime() > to.getTime()) {
      throw new DomainException("La fecha inicial no puede ser posterior a la final", 400);
    }

    const dates = await this.repository.findDistinctDatesInRange(from, to);
    const items: BackfillDailyDeliveryNotesReportsResultItem[] = [];

    for (const date of dates) {
      const notes = await this.repository.findAll({ date });
      const notesCount = notes.length;

      if (input.dryRun) {
        items.push({
          date,
          notesCount,
          status: "dry-run",
          fileId: null,
          fileName: null,
          folderName: null,
          webViewLink: null,
          errorMessage: null
        });
        continue;
      }

      try {
        const upload = await this.reportSender.execute({ date });
        items.push({
          date,
          notesCount: upload.notesCount,
          status: "uploaded",
          fileId: upload.fileId,
          fileName: upload.fileName,
          folderName: upload.folderName,
          webViewLink: upload.webViewLink,
          errorMessage: null
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        items.push({
          date,
          notesCount,
          status: "failed",
          fileId: null,
          fileName: null,
          folderName: null,
          webViewLink: null,
          errorMessage
        });
      }
    }

    return {
      from,
      to,
      dryRun: input.dryRun,
      processedDates: items.length,
      uploadedDates: items.filter((item) => item.status === "uploaded").length,
      failedDates: items.filter((item) => item.status === "failed").length,
      totalNotes: items.reduce((sum, item) => sum + item.notesCount, 0),
      items
    };
  }
}
