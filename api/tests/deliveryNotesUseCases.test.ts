import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer, CustomerInput } from "../src/domain/entities/Customer.js";
import type { DailyDeliveryNotesReportUpload } from "../src/domain/entities/DailyDeliveryNotesReportUpload.js";
import type { IEmailNotifier } from "../src/domain/ports/IEmailNotifier.js";
import type {
  DeliveryNote,
  DeliveryNoteFilters,
  DeliveryNoteInput,
  DeliveryNoteStatus
} from "../src/domain/entities/DeliveryNote.js";
import { CalculatePriceUseCase } from "../src/application/use-cases/deliveryNotes.js";
import {
  BackfillDailyDeliveryNotesReportsUseCase,
  ChangeDeliveryNoteStatusUseCase,
  CreateDeliveryNoteUseCase,
  DeleteDeliveryNoteUseCase,
  GetDashboardSummaryUseCase,
  GetDeliveryNoteUseCase,
  GetDeliveryNotesUseCase,
  SendDailyDeliveryNotesReportUseCase,
  UpdateDeliveryNoteUseCase
} from "../src/application/use-cases/deliveryNotes.js";

class InMemoryCustomerRepository {
  public customers: Customer[] = [];
  public update = vi.fn(async (id: string, input: CustomerInput) => {
    const current = this.customers.find((customer) => customer.id === id);
    if (!current) {
      throw new Error("customer not found");
    }

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

  public async findAll() {
    return this.customers;
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

  public async create(_input: CustomerInput): Promise<Customer> {
    throw new Error("not implemented");
  }

  public async delete() {
    throw new Error("not implemented");
  }

  public async hasDeliveryNotes() {
    return false;
  }
}

class InMemoryDeliveryNoteRepository {
  public notes: DeliveryNote[] = [];
  public create = vi.fn(
    async (
      input: DeliveryNoteInput & {
        number: string;
        customerName: string;
        totalAmount: number;
        items: DeliveryNote["items"];
      }
    ) => {
      const created: DeliveryNote = {
        id: crypto.randomUUID(),
        number: input.number,
        customerId: input.customerId,
        customerName: input.customerName,
        status: input.status,
        notes: input.notes ?? null,
        totalAmount: input.totalAmount,
        date: input.date ?? new Date(),
        items: input.items,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.notes.push(created);
      return created;
    }
  );
  public update = vi.fn(
    async (
      id: string,
      input: DeliveryNoteInput & {
        number: string;
        customerName: string;
        totalAmount: number;
        items: DeliveryNote["items"];
      }
    ) => {
      const updated: DeliveryNote = {
        id,
        number: input.number,
        customerId: input.customerId,
        customerName: input.customerName,
        status: input.status,
        notes: input.notes ?? null,
        totalAmount: input.totalAmount,
        date: input.date ?? new Date(),
        items: input.items,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.notes = this.notes.map((note) => (note.id === id ? updated : note));
      return updated;
    }
  );
  public delete = vi.fn(async (id: string) => {
    this.notes = this.notes.filter((note) => note.id !== id);
  });
  public updateStatus = vi.fn(async (id: string, status: DeliveryNoteStatus) => {
    const note = this.notes.find((entry) => entry.id === id)!;
    const updated = { ...note, status, updatedAt: new Date() };
    this.notes = this.notes.map((entry) => (entry.id === id ? updated : entry));
    return updated;
  });

  public async findAll(filters: DeliveryNoteFilters) {
    const filtered = this.notes.filter((note) => {
      if (filters.status && note.status !== filters.status) {
        return false;
      }
      if (filters.customerId && note.customerId !== filters.customerId) {
        return false;
      }
      if (filters.today || filters.date) {
        const referenceDate = filters.date ?? new Date();
        const sameDay =
          note.date.getFullYear() === referenceDate.getFullYear() &&
          note.date.getMonth() === referenceDate.getMonth() &&
          note.date.getDate() === referenceDate.getDate();

        if (!sameDay) {
          return false;
        }
      }
      return true;
    });

    const offset = filters.offset ?? 0;
    const end = typeof filters.limit === "number" ? offset + filters.limit : undefined;
    return filtered.slice(offset, end);
  }

  public async count(filters: DeliveryNoteFilters) {
    return this.notes.filter((note) => {
      if (filters.status && note.status !== filters.status) {
        return false;
      }
      if (filters.customerId && note.customerId !== filters.customerId) {
        return false;
      }
      if (filters.today || filters.date) {
        const referenceDate = filters.date ?? new Date();
        const sameDay =
          note.date.getFullYear() === referenceDate.getFullYear() &&
          note.date.getMonth() === referenceDate.getMonth() &&
          note.date.getDate() === referenceDate.getDate();

        if (!sameDay) {
          return false;
        }
      }
      return true;
    }).length;
  }

  public async findDistinctDatesInRange(from: Date, to: Date) {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    const uniqueDates = new Map<number, Date>();

    this.notes.forEach((note) => {
      const normalizedDate = new Date(
        note.date.getFullYear(),
        note.date.getMonth(),
        note.date.getDate()
      );
      const timestamp = normalizedDate.getTime();

      if (timestamp < start || timestamp > end || uniqueDates.has(timestamp)) {
        return;
      }

      uniqueDates.set(timestamp, normalizedDate);
    });

    return [...uniqueDates.values()].sort((left, right) => left.getTime() - right.getTime());
  }

  public async findById(id: string) {
    return this.notes.find((note) => note.id === id) ?? null;
  }

  public async findLatestNumberForYear(year: number) {
    const prefix = `ALB-${year}-`;
    const matches = this.notes
      .map((note) => note.number)
      .filter((number) => number.startsWith(prefix))
      .sort((left, right) => right.localeCompare(left));

    return matches[0] ?? null;
  }
}

class FakeDailyDeliveryNotesReportGenerator {
  public generate = vi.fn(async () => ({
    filename: "albaranes-2026-01-01.pdf",
    content: Buffer.from("pdf"),
    contentType: "application/pdf"
  }));
}

class FakeDailyDeliveryNotesReportUploader {
  public exists = vi.fn(async () => true);
  public delete = vi.fn(async () => undefined);
  public upload = vi.fn(
    async (): Promise<{
      fileId: string;
      fileName: string;
      folderName: string;
      webViewLink: string | null;
    }> => ({
      fileId: "2026-01/albaranes-2026-01-01.pdf",
      fileName: "albaranes-2026-01-01.pdf",
      folderName: "2026-01",
      webViewLink: "https://archivos.wwwmarcos-alvarez.com/2026-01/albaranes-2026-01-01.pdf"
    })
  );
}

class InMemoryDailyDeliveryNotesReportUploadRepository {
  public uploads: DailyDeliveryNotesReportUpload[] = [];

  public create = vi.fn(async (input: {
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
    lastSourceUpdatedAt: Date;
  }) => {
    const created: DailyDeliveryNotesReportUpload = {
      id: crypto.randomUUID(),
      reportDate: new Date(
        input.reportDate.getFullYear(),
        input.reportDate.getMonth(),
        input.reportDate.getDate()
      ),
      fileId: input.fileId,
      fileName: input.fileName,
      folderName: input.folderName,
      notesCount: input.notesCount,
      webViewLink: input.webViewLink,
      lastSourceUpdatedAt: input.lastSourceUpdatedAt,
      createdAt: new Date()
    };

    this.uploads.push(created);
    return created;
  });

  public async findByDate(reportDate: Date) {
    return (
      this.uploads.find(
        (upload) =>
          upload.reportDate.getFullYear() === reportDate.getFullYear() &&
          upload.reportDate.getMonth() === reportDate.getMonth() &&
          upload.reportDate.getDate() === reportDate.getDate()
      ) ?? null
    );
  }

  public updateByDate = vi.fn(async (input: {
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
    lastSourceUpdatedAt: Date;
  }) => {
    const normalizedDate = new Date(
      input.reportDate.getFullYear(),
      input.reportDate.getMonth(),
      input.reportDate.getDate()
    );
    const current = await this.findByDate(normalizedDate);

    if (!current) {
      throw new Error("daily report upload not found");
    }

    const updated: DailyDeliveryNotesReportUpload = {
      ...current,
      reportDate: normalizedDate,
      fileId: input.fileId,
      fileName: input.fileName,
      folderName: input.folderName,
      notesCount: input.notesCount,
      webViewLink: input.webViewLink,
      lastSourceUpdatedAt: input.lastSourceUpdatedAt
    };

    this.uploads = this.uploads.map((upload) =>
      upload.id === current.id ? updated : upload
    );

    return updated;
  });

  public deleteByDate = vi.fn(async (reportDate: Date) => {
    const normalizedDate = new Date(
      reportDate.getFullYear(),
      reportDate.getMonth(),
      reportDate.getDate()
    );

    this.uploads = this.uploads.filter(
      (upload) => upload.reportDate.getTime() !== normalizedDate.getTime()
    );
  });
}

class FakeEmailNotifier implements IEmailNotifier {
  public sendDailyReportNotification = vi.fn(async () => undefined);
}

const buildCustomer = (): Customer => ({
  id: "customer-1",
  name: "Pinturas Lopez",
  email: null,
  phone: null,
  address: null,
  notes: null,
  pricePerLinearMeter: 10,
  pricePerSquareMeter: 20,
  minimumRate: 15,
  grosorPrecio: 5,
  specialPieces: [{ name: "Barandilla", price: 40 }],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z")
});

const buildNote = (
  id: string,
  status: DeliveryNoteStatus,
  date = "2026-01-01T00:00:00.000Z"
): DeliveryNote => ({
  id,
  number: `ALB-${id}`,
  customerId: "customer-1",
  customerName: "Pinturas Lopez",
  status,
  notes: null,
  totalAmount: status === "REVIEWED" ? 120 : 45,
  date: new Date(date),
  items: [
    {
      description: "Perfil",
      color: "RAL 9005",
      texture: "NORMAL",
      pricingMode: "DIMENSIONS",
      customUnitPrice: null,
      quantity: status === "REVIEWED" ? 4 : 2,
      unitPrice: status === "REVIEWED" ? 30 : 22.5,
      totalPrice: status === "REVIEWED" ? 120 : 45,
      linearMeters: status === "REVIEWED" ? 3 : null,
      squareMeters: null,
      thickness: null,
      primer: false
    }
  ],
  createdAt: new Date(date),
  updatedAt: new Date(date)
});

describe("delivery note use cases", () => {
  let customerRepository: InMemoryCustomerRepository;
  let deliveryNoteRepository: InMemoryDeliveryNoteRepository;
  let reportUploadRepository: InMemoryDailyDeliveryNotesReportUploadRepository;
  let emailNotifier: FakeEmailNotifier;
  let calculatePriceUseCase: CalculatePriceUseCase;

  beforeEach(() => {
    customerRepository = new InMemoryCustomerRepository();
    customerRepository.customers = [buildCustomer()];
    deliveryNoteRepository = new InMemoryDeliveryNoteRepository();
    reportUploadRepository = new InMemoryDailyDeliveryNotesReportUploadRepository();
    emailNotifier = new FakeEmailNotifier();
    deliveryNoteRepository.notes = [
      buildNote("note-draft", "DRAFT", "2026-01-01T00:00:00.000Z"),
      buildNote("note-reviewed", "REVIEWED", "2026-01-01T00:00:00.000Z"),
      buildNote("note-pending", "PENDING", "2026-01-02T00:00:00.000Z")
    ];
    calculatePriceUseCase = new CalculatePriceUseCase();
  });

  it("creates a delivery note with prices calculated by business rules", async () => {
    const useCase = new CreateDeliveryNoteUseCase(
      customerRepository,
      deliveryNoteRepository,
      calculatePriceUseCase
    );

    const result = await useCase.execute({
      customerId: "customer-1",
      status: "DRAFT",
      items: [
        {
          description: "Barandilla",
          color: "RAL 7016",
          texture: "NORMAL",
          quantity: 2
        },
        {
          description: "Perfil",
          color: "RAL 9005",
          texture: "MATE",
          linearMeters: 1,
          thickness: 4,
          primer: true,
          quantity: 1
        }
      ]
    });

    expect(deliveryNoteRepository.create).toHaveBeenCalledOnce();
    expect(result.number).toBe("ALB-2026-0001");
    expect(result.customerName).toBe("Pinturas Lopez");
    expect(result.totalAmount).toBe(140);
    expect(result.items[0]?.totalPrice).toBe(80);
    expect(result.items[1]?.totalPrice).toBe(60);
  });

  it("fails creating a delivery note for an unknown customer", async () => {
    const useCase = new CreateDeliveryNoteUseCase(
      customerRepository,
      deliveryNoteRepository,
      calculatePriceUseCase
    );

    await expect(
      useCase.execute({
        customerId: "missing",
        status: "DRAFT",
        items: [{ description: "Perfil", color: "RAL 9005", texture: "NORMAL", quantity: 1, linearMeters: 2 }]
      })
    ).rejects.toMatchObject({
      message: "Cliente no encontrado",
      statusCode: 404
    });
  });

  it("updates a delivery note recalculating totals", async () => {
    const useCase = new UpdateDeliveryNoteUseCase(
      customerRepository,
      deliveryNoteRepository,
      calculatePriceUseCase
    );

    const result = await useCase.execute("note-draft", {
      customerId: "customer-1",
      status: "PENDING",
      items: [{ description: "Perfil", color: "RAL 9005", texture: "NORMAL", quantity: 2, linearMeters: 1 }]
    });

    expect(deliveryNoteRepository.update).toHaveBeenCalledOnce();
    expect(result.number).toBe("ALB-note-draft");
    expect(result.totalAmount).toBe(30);
    expect(result.status).toBe("PENDING");
  });

  it("saves a new special piece when the item switch is enabled", async () => {
    const useCase = new CreateDeliveryNoteUseCase(
      customerRepository,
      deliveryNoteRepository,
      calculatePriceUseCase
    );

    const result = await useCase.execute({
      customerId: "customer-1",
      status: "DRAFT",
      items: [
        {
          description: "Puerta peatonal",
          color: "RAL 7016",
          linearMeters: 2,
          texture: "TEXTURADO",
          quantity: 1,
          saveAsSpecialPiece: true
        }
      ]
    });

    expect(customerRepository.update).toHaveBeenCalledOnce();
    expect(customerRepository.customers[0]?.specialPieces).toEqual([
      { name: "Barandilla", price: 40 },
      { name: "Puerta peatonal", price: 20 }
    ]);
    expect(result.items[0]?.unitPrice).toBe(20);
    expect(result.items[0]?.totalPrice).toBe(20);
  });

  it("creates a delivery note with custom unit pricing for a regular piece", async () => {
    const useCase = new CreateDeliveryNoteUseCase(
      customerRepository,
      deliveryNoteRepository,
      calculatePriceUseCase
    );

    const result = await useCase.execute({
      customerId: "customer-1",
      status: "DRAFT",
      items: [
        {
          description: "Pasamanos suelto",
          color: "RAL 7016",
          texture: "NORMAL",
          pricingMode: "UNIT",
          customUnitPrice: 18,
          quantity: 4
        }
      ]
    });

    expect(result.totalAmount).toBe(72);
    expect(result.items[0]?.pricingMode).toBe("UNIT");
    expect(result.items[0]?.customUnitPrice).toBe(18);
    expect(result.items[0]?.unitPrice).toBe(18);
  });

  it("deletes non-draft delivery notes", async () => {
    const useCase = new DeleteDeliveryNoteUseCase(deliveryNoteRepository);

    await useCase.execute("note-reviewed");

    expect(deliveryNoteRepository.delete).toHaveBeenCalledWith("note-reviewed");
    expect(await deliveryNoteRepository.findById("note-reviewed")).toBeNull();
  });

  it("deletes draft delivery notes", async () => {
    const useCase = new DeleteDeliveryNoteUseCase(deliveryNoteRepository);

    await useCase.execute("note-draft");

    expect(deliveryNoteRepository.delete).toHaveBeenCalledWith("note-draft");
    expect(await deliveryNoteRepository.findById("note-draft")).toBeNull();
  });

  it("updates status for an existing delivery note", async () => {
    const useCase = new ChangeDeliveryNoteStatusUseCase(deliveryNoteRepository);

    const result = await useCase.execute("note-pending", "REVIEWED");

    expect(deliveryNoteRepository.updateStatus).toHaveBeenCalledWith("note-pending", "REVIEWED");
    expect(result.status).toBe("REVIEWED");
  });

  it("throws when fetching an unknown delivery note", async () => {
    const useCase = new GetDeliveryNoteUseCase(deliveryNoteRepository);

    await expect(useCase.execute("missing")).rejects.toMatchObject({
      message: "Albarán no encontrado",
      statusCode: 404
    });
  });

  it("filters delivery notes by status", async () => {
    const useCase = new GetDeliveryNotesUseCase(deliveryNoteRepository);

    const result = await useCase.execute({ status: "PENDING" });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("note-pending");
  });

  it("filters delivery notes by a selected date", async () => {
    const useCase = new GetDeliveryNotesUseCase(deliveryNoteRepository);

    const result = await useCase.execute({
      date: new Date("2026-01-02T00:00:00.000Z")
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("note-pending");
  });

  it("builds the dashboard summary with totals and counters", async () => {
    const todayIso = new Date().toISOString();
    deliveryNoteRepository.notes = [
      buildNote("note-draft", "DRAFT", todayIso),
      buildNote("note-reviewed", "REVIEWED", todayIso),
      buildNote("note-pending", "PENDING", todayIso)
    ];

    const useCase = new GetDashboardSummaryUseCase(deliveryNoteRepository);

    const result = await useCase.execute();

    expect(result.stats.totalNotes).toBe(3);
    expect(result.stats.reviewed).toBe(1);
    expect(result.stats.pending).toBe(1);
    expect(result.stats.totalPieces).toBe(8);
    expect(result.stats.totalAmount).toBe(210);
  });

  it("generates the daily report PDF and uploads it to storage", async () => {
    const reportGenerator = new FakeDailyDeliveryNotesReportGenerator();
    const uploader = new FakeDailyDeliveryNotesReportUploader();
    const useCase = new SendDailyDeliveryNotesReportUseCase(
      customerRepository,
      deliveryNoteRepository,
      reportGenerator,
      uploader,
      reportUploadRepository,
      emailNotifier
    );

    const result = await useCase.execute({
      date: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(reportGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        customersById: {
          "customer-1": expect.objectContaining({
            name: "Pinturas Lopez",
            address: null,
            phone: null,
            email: null
          })
        }
      })
    );
    expect(uploader.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        attachment: expect.objectContaining({
          filename: "albaranes-2026-01-01.pdf"
        })
      })
    );
    expect(result.notesCount).toBe(2);
    expect(result.fileId).toBe("2026-01/albaranes-2026-01-01.pdf");
    expect(reportUploadRepository.create).toHaveBeenCalledOnce();
    expect(emailNotifier.sendDailyReportNotification).toHaveBeenCalledWith({
      date: "2026-01-01",
      notesCount: 2,
      fileName: "albaranes-2026-01-01.pdf",
      webViewLink: "https://archivos.wwwmarcos-alvarez.com/2026-01/albaranes-2026-01-01.pdf"
    });
  });

  it("reuses the stored daily upload and avoids duplicate storage writes", async () => {
    const reportGenerator = new FakeDailyDeliveryNotesReportGenerator();
    const uploader = new FakeDailyDeliveryNotesReportUploader();
    const useCase = new SendDailyDeliveryNotesReportUseCase(
      customerRepository,
      deliveryNoteRepository,
      reportGenerator,
      uploader,
      reportUploadRepository,
      emailNotifier
    );

    const firstResult = await useCase.execute({
      date: new Date("2026-01-01T00:00:00.000Z")
    });
    const secondResult = await useCase.execute({
      date: new Date("2026-01-01T12:30:00.000Z")
    });

    expect(reportGenerator.generate).toHaveBeenCalledOnce();
    expect(uploader.upload).toHaveBeenCalledOnce();
    expect(reportUploadRepository.create).toHaveBeenCalledOnce();
    expect(secondResult).toEqual(firstResult);
    expect(emailNotifier.sendDailyReportNotification).toHaveBeenCalledOnce();
  });

  it("regenerates the daily upload when source delivery notes changed", async () => {
    const reportGenerator = new FakeDailyDeliveryNotesReportGenerator();
    const uploader = new FakeDailyDeliveryNotesReportUploader();
    const useCase = new SendDailyDeliveryNotesReportUseCase(
      customerRepository,
      deliveryNoteRepository,
      reportGenerator,
      uploader,
      reportUploadRepository,
      emailNotifier
    );

    await useCase.execute({
      date: new Date("2026-01-01T00:00:00.000Z")
    });

    deliveryNoteRepository.notes = deliveryNoteRepository.notes.map((note) =>
      note.id === "note-reviewed"
        ? { ...note, updatedAt: new Date("2026-01-01T15:00:00.000Z") }
        : note
    );

    await useCase.execute({
      date: new Date("2026-01-01T16:00:00.000Z")
    });

    expect(uploader.upload).toHaveBeenCalledTimes(2);
    expect(reportUploadRepository.updateByDate).toHaveBeenCalledTimes(1);
  });

  it("regenerates the daily upload when the stored file no longer exists", async () => {
    const reportGenerator = new FakeDailyDeliveryNotesReportGenerator();
    const uploader = new FakeDailyDeliveryNotesReportUploader();
    uploader.exists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const useCase = new SendDailyDeliveryNotesReportUseCase(
      customerRepository,
      deliveryNoteRepository,
      reportGenerator,
      uploader,
      reportUploadRepository,
      emailNotifier
    );

    await useCase.execute({
      date: new Date("2026-01-01T00:00:00.000Z")
    });
    const result = await useCase.execute({
      date: new Date("2026-01-01T12:30:00.000Z")
    });

    expect(uploader.exists).toHaveBeenCalledTimes(1);
    expect(uploader.upload).toHaveBeenCalledTimes(2);
    expect(reportUploadRepository.create).toHaveBeenCalledTimes(1);
    expect(reportUploadRepository.updateByDate).toHaveBeenCalledTimes(1);
    expect(result.fileId).toBe("2026-01/albaranes-2026-01-01.pdf");
  });

  it("deletes the stored report reference when the day no longer has delivery notes", async () => {
    const reportGenerator = new FakeDailyDeliveryNotesReportGenerator();
    const uploader = new FakeDailyDeliveryNotesReportUploader();
    const useCase = new SendDailyDeliveryNotesReportUseCase(
      customerRepository,
      deliveryNoteRepository,
      reportGenerator,
      uploader,
      reportUploadRepository,
      emailNotifier
    );

    await useCase.execute({
      date: new Date("2026-01-01T00:00:00.000Z")
    });

    deliveryNoteRepository.notes = deliveryNoteRepository.notes.filter(
      (note) =>
        !(
          note.date.getFullYear() === 2026 &&
          note.date.getMonth() === 0 &&
          note.date.getDate() === 1
        )
    );

    await expect(
      useCase.execute({
        date: new Date("2026-01-01T12:30:00.000Z")
      })
    ).rejects.toMatchObject({
      message: "No hay albaranes para la fecha seleccionada",
      statusCode: 404
    });

    expect(uploader.delete).toHaveBeenCalledWith({
      fileId: "2026-01/albaranes-2026-01-01.pdf"
    });
    expect(reportUploadRepository.deleteByDate).toHaveBeenCalledTimes(1);
    await expect(
      reportUploadRepository.findByDate(new Date("2026-01-01T00:00:00.000Z"))
    ).resolves.toBeNull();
  });

  it("logs email failures without failing the uploaded report", async () => {
    const reportGenerator = new FakeDailyDeliveryNotesReportGenerator();
    const uploader = new FakeDailyDeliveryNotesReportUploader();
    emailNotifier.sendDailyReportNotification = vi.fn(async () => {
      throw new Error("smtp failed");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const useCase = new SendDailyDeliveryNotesReportUseCase(
      customerRepository,
      deliveryNoteRepository,
      reportGenerator,
      uploader,
      reportUploadRepository,
      emailNotifier
    );

    const result = await useCase.execute({
      date: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(result.fileId).toBe("2026-01/albaranes-2026-01-01.pdf");
    expect(consoleErrorSpy).toHaveBeenCalledWith("[EmailNotifier]", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it("uses the stored file id as fallback when storage does not return a web link", async () => {
    const reportGenerator = new FakeDailyDeliveryNotesReportGenerator();
    const uploader = new FakeDailyDeliveryNotesReportUploader();
    uploader.upload = vi.fn(async () => ({
      fileId: "gdrive:Epoxiron albaranes/2026-01/albaranes-2026-01-01.pdf",
      fileName: "albaranes-2026-01-01.pdf",
      folderName: "2026-01",
      webViewLink: null
    }));
    const useCase = new SendDailyDeliveryNotesReportUseCase(
      customerRepository,
      deliveryNoteRepository,
      reportGenerator,
      uploader,
      reportUploadRepository,
      emailNotifier
    );

    await useCase.execute({
      date: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(emailNotifier.sendDailyReportNotification).toHaveBeenCalledWith({
      date: "2026-01-01",
      notesCount: 2,
      fileName: "albaranes-2026-01-01.pdf",
      webViewLink: "gdrive:Epoxiron albaranes/2026-01/albaranes-2026-01-01.pdf"
    });
  });

  it("fails uploading the daily report when there are no delivery notes", async () => {
    const reportGenerator = new FakeDailyDeliveryNotesReportGenerator();
    const uploader = new FakeDailyDeliveryNotesReportUploader();
    const useCase = new SendDailyDeliveryNotesReportUseCase(
      customerRepository,
      deliveryNoteRepository,
      reportGenerator,
      uploader,
      reportUploadRepository,
      emailNotifier
    );

    await expect(
      useCase.execute({
        date: new Date("2026-01-03T00:00:00.000Z")
      })
    ).rejects.toMatchObject({
      message: "No hay albaranes para la fecha seleccionada",
      statusCode: 404
    });
    expect(uploader.upload).not.toHaveBeenCalled();
  });

  it("fails uploading the daily report when report uploads are not configured", async () => {
    const useCase = new SendDailyDeliveryNotesReportUseCase(
      customerRepository,
      deliveryNoteRepository,
      null,
      null,
      reportUploadRepository,
      emailNotifier
    );

    await expect(
      useCase.execute({
        date: new Date("2026-01-01T00:00:00.000Z")
      })
    ).rejects.toMatchObject({
      message: "La subida del informe diario no esta configurada",
      statusCode: 503
    });
  });

  it("builds a dry-run summary for the unique reportable dates", async () => {
    const sender = {
      execute: vi.fn()
    };
    const useCase = new BackfillDailyDeliveryNotesReportsUseCase(
      deliveryNoteRepository,
      sender
    );

    const result = await useCase.execute({
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-03T00:00:00.000Z"),
      dryRun: true
    });

    expect(sender.execute).not.toHaveBeenCalled();
    expect(result.processedDates).toBe(2);
    expect(result.uploadedDates).toBe(0);
    expect(result.failedDates).toBe(0);
    expect(result.totalNotes).toBe(3);
    expect(result.items).toEqual([
      expect.objectContaining({
        status: "dry-run",
        notesCount: 2,
        fileId: null
      }),
      expect.objectContaining({
        status: "dry-run",
        notesCount: 1,
        fileId: null
      })
    ]);
  });

  it("backfills reports and continues after a failed day", async () => {
    const sender = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({
          date: new Date("2026-01-01T00:00:00.000Z"),
          fileId: "2026-01/albaranes-2026-01-01.pdf",
          fileName: "albaranes-2026-01-01.pdf",
          folderName: "2026-01",
          notesCount: 2,
          webViewLink: "https://archivos.example.com/2026-01/albaranes-2026-01-01.pdf"
        })
        .mockRejectedValueOnce(new Error("fallo r2"))
    };
    const useCase = new BackfillDailyDeliveryNotesReportsUseCase(
      deliveryNoteRepository,
      sender
    );

    const result = await useCase.execute({
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-03T00:00:00.000Z"),
      dryRun: false
    });

    expect(sender.execute).toHaveBeenCalledTimes(2);
    expect(result.processedDates).toBe(2);
    expect(result.uploadedDates).toBe(1);
    expect(result.failedDates).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: "uploaded",
        fileId: "2026-01/albaranes-2026-01-01.pdf",
        notesCount: 2
      })
    );
    expect(result.items[1]).toEqual(
      expect.objectContaining({
        status: "failed",
        fileId: null,
        errorMessage: "fallo r2",
        notesCount: 1
      })
    );
  });
});
