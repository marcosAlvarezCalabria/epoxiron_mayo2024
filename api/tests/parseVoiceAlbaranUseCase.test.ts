import { describe, expect, it, vi } from "vitest";
import { ParseVoiceAlbaranUseCase } from "../src/application/use-cases/parseVoiceAlbaran.js";
import type { Customer } from "../src/domain/entities/Customer.js";
import type {
  ParsedVoiceAlbaran,
  VoiceAlbaranParser,
  VoiceAlbaranParserContext
} from "../src/domain/ports/VoiceAlbaranParser.js";
import type { CustomerRepository } from "../src/domain/repositories/CustomerRepository.js";

const buildCustomer = (name: string): Customer => ({
  id: name,
  name,
  email: null,
  phone: null,
  address: null,
  notes: null,
  vat: null,
  legalName: null,
  fiscalStreet: null,
  fiscalStreet2: null,
  fiscalCity: null,
  fiscalZip: null,
  fiscalProvince: null,
  fiscalCountryCode: null,
  paymentTermCode: null,
  externalPartnerId: null,
  active: true,
  pricePerLinearMeter: 1,
  pricePerSquareMeter: 1,
  minimumRate: 1,
  grosorPrecio: null,
  specialPieces: [],
  createdAt: new Date("2026-07-09T00:00:00.000Z"),
  updatedAt: new Date("2026-07-09T00:00:00.000Z")
});

const buildRepository = (customers: Customer[]): CustomerRepository => ({
  create: vi.fn(),
  findAll: vi.fn().mockResolvedValue(customers),
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  setActive: vi.fn(),
  update: vi.fn()
});

const buildParser = (parsed: ParsedVoiceAlbaran): VoiceAlbaranParser => ({
  parseTranscript: vi.fn<VoiceAlbaranParser["parseTranscript"]>().mockImplementation(
    async (_transcript: string, _context?: VoiceAlbaranParserContext) => parsed
  )
});

const buildParsedItem = (
  description: string,
  squareMeters: number | null = null
): ParsedVoiceAlbaran["items"][number] => ({
  description,
  color: "RAL 9005",
  specialPieceIntent: false,
  customUnitPrice: null,
  pricingMode: "DIMENSIONS",
  texture: "NORMAL",
  linearMeters: null,
  squareMeters,
  widthMm: null,
  heightMm: null,
  hasThickness: false,
  hasPrimer: false,
  saveAsSpecialPiece: false,
  quantity: 1
});

describe("ParseVoiceAlbaranUseCase", () => {
  it("conserva en milímetros varias medidas de vallas dictadas sin unidad", async () => {
    const parser = {
      parseTranscript: vi.fn(async () => ({
        customerName: "Krzysztof Hodorowicz",
        date: "2026-09-11",
        notes: null,
        items: [
          buildParsedItem("VALLA", 1.938),
          buildParsedItem("VALLA", 1.805),
          buildParsedItem("VALLA", 2.1)
        ]
      }))
    };
    const useCase = new ParseVoiceAlbaranUseCase(
      parser,
      buildRepository([buildCustomer("KRZYSZTOF HÓDOROWICZ")])
    );

    const result = await useCase.execute(
      "Albarán para Christoph. Valla de lama 9005 2040 x 950 1 unidad. " +
      "Valla lama 9005 1900 x 950 1 unidad. Valla lama 9005 2100 x 1000 1 unidad."
    );

    expect(result.items).toMatchObject([
      { description: "VALLA", widthMm: 2040, heightMm: 950 },
      { description: "VALLA", widthMm: 1900, heightMm: 950 },
      { description: "VALLA", widthMm: 2100, heightMm: 1000 }
    ]);
  });
  it("removes square meters derived only from spoken dimensions", async () => {
    const parser = buildParser({
      customerName: "ditrametal",
      date: "2026-07-09",
      notes: null,
      items: [
        {
          description: "CHAPA 3000X1000",
          color: "RAL 9005",
          specialPieceIntent: false,
          customUnitPrice: null,
          pricingMode: "DIMENSIONS",
          texture: "TEXTURADO",
          linearMeters: null,
          squareMeters: 3,
          hasThickness: false,
          hasPrimer: false,
          saveAsSpecialPiece: false,
          quantity: 1
        }
      ]
    });

    const useCase = new ParseVoiceAlbaranUseCase(parser, buildRepository([buildCustomer("Ditrametal")]));
    const result = await useCase.execute("chapa 9005 texturado 3000 por 1000");

    expect(result.customerName).toBe("Ditrametal");
    expect(result.items[0]?.squareMeters).toBeNull();
    expect(result.items[0]?.widthMm).toBe(3000);
    expect(result.items[0]?.heightMm).toBe(1000);
  });

  it("preserves square meters when they are spoken explicitly", async () => {
    const parser = buildParser({
      customerName: null,
      date: "2026-07-09",
      notes: null,
      items: [
        {
          description: "CHAPA 3000X1000",
          color: "RAL 9005",
          specialPieceIntent: false,
          customUnitPrice: null,
          pricingMode: "DIMENSIONS",
          texture: "TEXTURADO",
          linearMeters: null,
          squareMeters: 3,
          hasThickness: false,
          hasPrimer: false,
          saveAsSpecialPiece: false,
          quantity: 1
        }
      ]
    });

    const useCase = new ParseVoiceAlbaranUseCase(parser, buildRepository([]));
    const result = await useCase.execute("chapa 9005 texturado 3000 por 1000 y 3 m2");

    expect(result.items[0]?.squareMeters).toBe(3);
  });

  it("normalizes millimeter dimensions to the centimeter description format", async () => {
    const parser = buildParser({
      customerName: "Ditrametal",
      date: "2026-07-09",
      notes: null,
      items: [{
        description: "CHAPA 1000X500",
        color: "RAL 9005",
        specialPieceIntent: false,
        customUnitPrice: null,
        pricingMode: "DIMENSIONS",
        texture: "NORMAL",
        linearMeters: null,
        squareMeters: null,
        hasThickness: false,
        hasPrimer: false,
        saveAsSpecialPiece: false,
        quantity: 1
      }]
    });
    const useCase = new ParseVoiceAlbaranUseCase(
      parser,
      buildRepository([buildCustomer("Ditrametal")])
    );

    const result = await useCase.execute("una chapa de 1000 x 500 milímetros");

    expect(result.items[0]?.description).toBe("CHAPA 100X50");
    expect(result.items[0]?.widthMm).toBe(1000);
    expect(result.items[0]?.heightMm).toBe(500);
  });

  it("normalizes mixed meter and centimeter dimensions", async () => {
    const parser = buildParser({
      customerName: "Ditrametal",
      date: "2026-07-09",
      notes: null,
      items: [{
        description: "CHAPA 1 M X 50 CM",
        color: "RAL 9010",
        specialPieceIntent: false,
        customUnitPrice: null,
        pricingMode: "DIMENSIONS",
        texture: "NORMAL",
        linearMeters: null,
        squareMeters: null,
        hasThickness: false,
        hasPrimer: false,
        saveAsSpecialPiece: false,
        quantity: 1
      }]
    });
    const useCase = new ParseVoiceAlbaranUseCase(
      parser,
      buildRepository([buildCustomer("Ditrametal")])
    );

    const result = await useCase.execute("una chapa de 1 m x 50 cm");

    expect(result.items[0]?.description).toBe("CHAPA 100X50");
    expect(result.items[0]?.widthMm).toBe(1000);
    expect(result.items[0]?.heightMm).toBe(500);
  });

  it("interprets workshop dimensions without a unit as millimeters", async () => {
    const parser = buildParser({
      customerName: "Ditrametal",
      date: "2026-07-09",
      notes: null,
      items: [{
        description: "MESA 500X500",
        color: "RAL 9005",
        specialPieceIntent: false,
        customUnitPrice: null,
        pricingMode: "DIMENSIONS",
        texture: "TEXTURADO",
        linearMeters: null,
        squareMeters: null,
        hasThickness: false,
        hasPrimer: false,
        saveAsSpecialPiece: false,
        quantity: 1
      }]
    });
    const useCase = new ParseVoiceAlbaranUseCase(
      parser,
      buildRepository([buildCustomer("Ditrametal")])
    );

    const result = await useCase.execute("una mesa de 500 x 500 RAL 9005");

    expect(result.items[0]?.description).toBe("MESA 50X50");
    expect(result.items[0]?.widthMm).toBe(500);
    expect(result.items[0]?.heightMm).toBe(500);
  });
});
