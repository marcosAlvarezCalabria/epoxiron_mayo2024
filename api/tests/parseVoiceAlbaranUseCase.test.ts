import { describe, expect, it, vi } from "vitest";
import { ParseVoiceAlbaranUseCase } from "../src/application/use-cases/parseVoiceAlbaran.js";
import type { Customer } from "../src/domain/entities/Customer.js";
import type {
  ParsedVoiceAlbaran,
  VoiceAlbaranParser,
  VoiceAlbaranParserContext
} from "../src/domain/ports/VoiceAlbaranParser.js";
import type { CustomerRepository } from "../src/domain/repositories/CustomerRepository.js";
import { normalizeParsedVoiceAlbaran } from "../src/schemas/voiceSchemas.js";

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
  it("preserves every explicit field in a multiline workshop transcript", async () => {
    const customer = {
      ...buildCustomer("DITRAMETAL"),
      specialPieces: [
        { name: "PERFIL 1023 460X200", price: 10 },
        { name: "PERFIL 1023 1460X200", price: 12 }
      ]
    };
    const parsedItems: ParsedVoiceAlbaran["items"] = [
      { ...buildParsedItem("TAPA"), color: "RAL 7016", texture: "MATE", quantity: 2 },
      {
        ...buildParsedItem("CHAPA 420X400"),
        color: "RAL 7016",
        texture: "MATE",
        widthMm: 420,
        heightMm: 400,
        quantity: 3
      },
      {
        ...buildParsedItem("CHAPA 120X120"),
        color: "RAL 7016",
        texture: "MATE",
        widthMm: 120,
        heightMm: 120,
        quantity: 3
      },
      {
        ...buildParsedItem("PERFIL 460X200"),
        color: "RAL 7016",
        texture: "MATE",
        widthMm: 460,
        heightMm: 200,
        quantity: 2
      }
    ];
    const parser = buildParser({
      customerName: "DITRAMETAL",
      date: "2026-10-29",
      notes: null,
      items: parsedItems
    });
    const useCase = new ParseVoiceAlbaranUseCase(parser, buildRepository([customer]));
    const transcript =
      "tapa 7016 mate dos unidades " +
      "chapa 7016 mate 420 x 400 tres unidades " +
      "chapa 7016 mate 120 x 120 tres unidades " +
      "perfil 7016 mate 460 x 200 dos unidades";

    const result = await useCase.execute(transcript);

    expect(result.items).toHaveLength(4);
    expect(result.items).toMatchObject([
      { description: "TAPA", color: "RAL 7016", texture: "MATE", quantity: 2 },
      { description: "CHAPA 420X400", color: "RAL 7016", texture: "MATE", quantity: 3 },
      { description: "CHAPA 120X120", color: "RAL 7016", texture: "MATE", quantity: 3 },
      { description: "PERFIL 460X200", color: "RAL 7016", texture: "MATE", quantity: 2 }
    ]);
    expect(parser.parseTranscript).toHaveBeenCalledWith(
      transcript,
      expect.objectContaining({ specialPieceNames: [] })
    );
  });

  it("rejects a multiline extraction that changes an explicit color", async () => {
    const badItems: ParsedVoiceAlbaran["items"] = [
      { ...buildParsedItem("TAPA"), color: "RAL 7016", texture: "MATE", quantity: 2 },
      { ...buildParsedItem("CHAPA 420X400"), color: "RAL 7016", texture: "MATE", quantity: 3 },
      { ...buildParsedItem("CHAPA 120X120"), color: "RAL 7016", texture: "MATE", quantity: 3 },
      { ...buildParsedItem("PERFIL 1023 460X200"), color: null, texture: "MATE", quantity: 2 }
    ];
    const parser = buildParser({
      customerName: "DITRAMETAL",
      date: "2026-10-29",
      notes: null,
      items: badItems
    });
    const customer = {
      ...buildCustomer("DITRAMETAL"),
      specialPieces: [{ name: "PERFIL 1023 460X200", price: 10 }]
    };
    const useCase = new ParseVoiceAlbaranUseCase(parser, buildRepository([customer]));

    await expect(useCase.execute(
      "tapa 7016 mate dos unidades " +
      "chapa 7016 mate 420 x 400 tres unidades " +
      "chapa 7016 mate 120 x 120 tres unidades " +
      "perfil 7016 mate 460 x 200 dos unidades"
    )).rejects.toMatchObject({ name: "VoiceExtractionIntegrityError" });
  });

  it("rejects a multiline extraction that drops one dictated line", async () => {
    const parser = buildParser({
      customerName: "DITRAMETAL",
      date: "2026-10-29",
      notes: null,
      items: [
        { ...buildParsedItem("TAPA"), color: "RAL 7016", texture: "MATE", quantity: 2 },
        { ...buildParsedItem("CHAPA"), color: "RAL 7016", texture: "MATE", quantity: 3 },
        { ...buildParsedItem("PERFIL"), color: "RAL 7016", texture: "MATE", quantity: 2 }
      ]
    });
    const useCase = new ParseVoiceAlbaranUseCase(
      parser,
      buildRepository([buildCustomer("DITRAMETAL")])
    );

    await expect(useCase.execute(
      "tapa 7016 mate dos unidades " +
      "chapa 7016 mate 420 x 400 tres unidades " +
      "chapa 7016 mate 120 x 120 tres unidades " +
      "perfil 7016 mate 460 x 200 dos unidades"
    )).rejects.toMatchObject({ name: "VoiceExtractionIntegrityError" });
  });

  it("recovers known RAL colors when the model separates the finish from the description", async () => {
    const normalized = normalizeParsedVoiceAlbaran({
      customerName: "DITRAMETAL",
      date: "2026-10-29",
      notes: null,
      items: [
        {
          description: "ángulo 7035",
          color: null,
          texture: "mate",
          linearMeters: 3,
          quantity: 3
        },
        {
          description: "ángulo 1021",
          color: null,
          texture: "mate",
          linearMeters: 3,
          quantity: 8
        },
        {
          description: "perfil 1023 1460x200",
          color: null,
          texture: "mate",
          quantity: 32
        },
        {
          description: "perfil 1023 460x200",
          color: null,
          texture: "mate",
          quantity: 12
        }
      ]
    });
    const parser = buildParser(normalized);
    const useCase = new ParseVoiceAlbaranUseCase(
      parser,
      buildRepository([buildCustomer("DITRAMETAL")])
    );

    const result = await useCase.execute(
      "pedido para Ditrametal ángulo 7035 mate 3 m lineal tres unidades " +
      "ángulo 1021 mate 3 m lineal ocho unidades " +
      "perfil 1023 mate 1460 x 200 32 unidades " +
      "perfil 1023 mate 460 x 200 12 unidades"
    );

    expect(result.items).toMatchObject([
      { description: "ÁNGULO", color: "RAL 7035", texture: "MATE", quantity: 3 },
      { description: "ÁNGULO", color: "RAL 1021", texture: "MATE", quantity: 8 },
      { description: "PERFIL 1460X200", color: "RAL 1023", texture: "MATE", quantity: 32 },
      { description: "PERFIL 460X200", color: "RAL 1023", texture: "MATE", quantity: 12 }
    ]);
  });

  it("only includes the special-piece catalogue when special intent is explicit", async () => {
    const customer = {
      ...buildCustomer("DITRAMETAL"),
      specialPieces: [
        { name: "PERFIL 1023 460X200", price: 10 },
        { name: "TAPA ESPECIAL", price: 5 }
      ]
    };
    const parser = buildParser({
      customerName: "DITRAMETAL",
      date: "2026-10-29",
      notes: null,
      items: [{ ...buildParsedItem("TAPA ESPECIAL"), specialPieceIntent: true }]
    });
    const useCase = new ParseVoiceAlbaranUseCase(parser, buildRepository([customer]));

    await useCase.execute("una pieza especial para DITRAMETAL");

    expect(parser.parseTranscript).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        specialPieceNames: ["PERFIL 1023 460X200", "TAPA ESPECIAL"]
      })
    );
  });

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

  it("preserves linear and square meters spoken for the same item", async () => {
    const parsedItem = buildParsedItem("PERFIL MIXTO", 1.5);
    parsedItem.linearMeters = 2;
    const parser = buildParser({
      customerName: null,
      date: "2026-07-09",
      notes: null,
      items: [parsedItem]
    });

    const useCase = new ParseVoiceAlbaranUseCase(parser, buildRepository([]));
    const result = await useCase.execute(
      "un perfil mixto de 2 metros lineales y 1,5 metros cuadrados"
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      description: "PERFIL MIXTO",
      linearMeters: 2,
      squareMeters: 1.5
    });
  });

  it("keeps millimeter dimensions in the description", async () => {
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

    expect(result.items[0]?.description).toBe("CHAPA 1000X500");
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

    expect(result.items[0]?.description).toBe("CHAPA 1000X500");
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

    expect(result.items[0]?.description).toBe("MESA 500X500");
    expect(result.items[0]?.widthMm).toBe(500);
    expect(result.items[0]?.heightMm).toBe(500);
  });
});
