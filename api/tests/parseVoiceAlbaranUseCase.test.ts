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
  delete: vi.fn(),
  findAll: vi.fn().mockResolvedValue(customers),
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  hasDeliveryNotes: vi.fn(),
  update: vi.fn()
});

const buildParser = (parsed: ParsedVoiceAlbaran): VoiceAlbaranParser => ({
  parseTranscript: vi.fn<VoiceAlbaranParser["parseTranscript"]>().mockImplementation(
    async (_transcript: string, _context?: VoiceAlbaranParserContext) => parsed
  )
});

describe("ParseVoiceAlbaranUseCase", () => {
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
});
