import type { Customer } from "../../domain/entities/Customer.js";
import type { VoiceAlbaranParser, ParsedVoiceAlbaran } from "../../domain/ports/VoiceAlbaranParser.js";
import type { CustomerRepository } from "../../domain/repositories/CustomerRepository.js";
import { isKnownRalCode } from "../../domain/services/ralColorCodes.js";

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const compactText = (value: string): string => normalizeText(value).replace(/\s+/g, "");
const uppercaseSpanish = (value: string): string => value.toLocaleUpperCase("es-ES").trim();
const dimensionPattern = /\b\d+(?:[.,]\d+)?\s*(?:x|\*|por)\s*\d+(?:[.,]\d+)?\b/i;
const explicitSquareMetersPattern =
  /\b\d+(?:[.,]\d+)?\s*(?:m2|m\^2|metros?\s+cuadrados?)\b/i;
const spokenDimensionPattern =
  /\b(\d+(?:[.,]\d+)?)\s*(mil[ií]metros?|mm|cent[ií]metros?|cm|metros?|m)?\s*(?:x|\*|por)\s*(\d+(?:[.,]\d+)?)\s*(mil[ií]metros?|mm|cent[ií]metros?|cm|metros?|m)?\b/i;
const descriptionDimensionPattern =
  /\d+(?:[.,]\d+)?\s*(?:MM|CM|M)?\s*(?:X|\*|POR)\s*\d+(?:[.,]\d+)?\s*(?:MM|CM|M)?/i;
const specialPieceIntentPattern =
  /\b(?:especial|especiales|pieza\s+especial|piezas\s+especiales|listado\s+especial)\b/i;
const quantityPattern =
  /\b(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte)\s*(?:ud|uds|unidad|unidades)\b/giu;
const explicitRalPattern =
  /\b(?:(ral)\s*)?([1-9]\d{3})\b(?:\s+(mate|texturad[oa]|texturizad[oa]|gofrad[oa]|gof))?/giu;
const explicitTexturePattern = /\b(mate|texturad[oa]|texturizad[oa]|gofrad[oa]|gof)\b/giu;

const SPANISH_QUANTITIES: Readonly<Record<string, number>> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20
};

export class VoiceExtractionIntegrityError extends Error {
  public constructor() {
    super("La extracción no conservó todas las líneas o sus datos explícitos.");
    this.name = "VoiceExtractionIntegrityError";
  }
}

const spokenQuantities = (transcript: string): number[] =>
  [...transcript.matchAll(quantityPattern)].flatMap((match) => {
    const value = normalizeText(match[1] ?? "");
    const quantity = /^\d+$/.test(value)
      ? Number.parseInt(value, 10)
      : SPANISH_QUANTITIES[value];
    return quantity != null && quantity > 0 ? [quantity] : [];
  });

const spokenRalCodes = (transcript: string): string[] =>
  [...transcript.matchAll(explicitRalPattern)].flatMap((match) => {
    const code = match[2] ?? "";
    return Boolean(match[1]) && isKnownRalCode(code) ? [code] : [];
  });

const spokenFinishCodes = (transcript: string): string[] =>
  [...transcript.matchAll(explicitRalPattern)].flatMap((match) => {
    const code = match[2] ?? "";
    return Boolean(match[3]) && isKnownRalCode(code) ? [code] : [];
  });

const spokenTextures = (transcript: string): ParsedVoiceAlbaran["items"][number]["texture"][] =>
  [...transcript.matchAll(explicitTexturePattern)].map((match) => {
    const texture = normalizeText(match[1] ?? "");
    if (texture === "mate") return "MATE" as const;
    if (texture.startsWith("gof")) return "GOFRADO" as const;
    return "TEXTURADO" as const;
  });

const parsedRalCode = (color: string | null): string | null =>
  color?.match(/\b(?:RAL\s*)?([1-9]\d{3})\b/i)?.[1] ?? null;

const parsedItemContainsCode = (
  item: ParsedVoiceAlbaran["items"][number] | undefined,
  code: string
): boolean => {
  if (!item) return false;
  if (parsedRalCode(item.color) === code) return true;
  return new RegExp(`\\b${code}\\b`, "i").test(item.description);
};

const validateExplicitTranscriptEvidence = (
  transcript: string,
  parsed: ParsedVoiceAlbaran
): ParsedVoiceAlbaran => {
  const quantities = spokenQuantities(transcript);
  const ralCodes = spokenRalCodes(transcript);
  const finishCodes = spokenFinishCodes(transcript);
  const textures = spokenTextures(transcript);
  const itemCount = parsed.items.length;

  if (quantities.length >= 2 && quantities.length !== itemCount) {
    throw new VoiceExtractionIntegrityError();
  }
  if (
    quantities.length === itemCount &&
    quantities.some((quantity, index) => parsed.items[index]?.quantity !== quantity)
  ) {
    throw new VoiceExtractionIntegrityError();
  }
  if (
    ralCodes.length === itemCount &&
    ralCodes.some((code, index) => parsedRalCode(parsed.items[index]?.color ?? null) !== code)
  ) {
    throw new VoiceExtractionIntegrityError();
  }
  if (
    finishCodes.length === itemCount &&
    finishCodes.some((code, index) => !parsedItemContainsCode(parsed.items[index], code))
  ) {
    throw new VoiceExtractionIntegrityError();
  }
  if (
    textures.length === itemCount &&
    textures.some((texture, index) => parsed.items[index]?.texture !== texture)
  ) {
    throw new VoiceExtractionIntegrityError();
  }

  return parsed;
};

const specialPieceNamesForTranscript = (
  transcript: string,
  customers: Customer[]
): string[] => {
  const names = Array.from(
    new Set(
      customers.flatMap((customer) =>
        customer.specialPieces
          .map((piece) => piece.name.trim())
          .filter((pieceName) => pieceName.length > 0)
      )
    )
  );
  const normalizedTranscript = ` ${normalizeText(transcript)} `;
  const exactNames = names.filter((name) => {
    const normalizedName = normalizeText(name);
    return normalizedName.length > 0 && normalizedTranscript.includes(` ${normalizedName} `);
  });
  if (exactNames.length > 0) return exactNames.slice(0, 20);
  return specialPieceIntentPattern.test(transcript) ? names.slice(0, 200) : [];
};

const scoreCustomerMatch = (customerName: string, spokenName: string): number => {
  const normalizedCustomer = normalizeText(customerName);
  const normalizedSpoken = normalizeText(spokenName);
  const compactCustomer = compactText(customerName);
  const compactSpoken = compactText(spokenName);

  if (!normalizedCustomer || !normalizedSpoken) {
    return 0;
  }

  if (compactCustomer === compactSpoken) {
    return 1;
  }

  if (compactCustomer.includes(compactSpoken) || compactSpoken.includes(compactCustomer)) {
    return 0.96;
  }

  const customerTokens = normalizedCustomer.split(" ").filter(Boolean);
  const spokenTokens = normalizedSpoken.split(" ").filter(Boolean);
  const sharedTokenCount = spokenTokens.filter((token) =>
    customerTokens.some((customerToken) => customerToken.startsWith(token) || token.startsWith(customerToken))
  ).length;

  return sharedTokenCount / Math.max(spokenTokens.length, customerTokens.length);
};

const resolveCustomerName = (customers: Customer[], spokenName: string | null): string | null => {
  if (!spokenName) {
    return null;
  }

  const bestMatch = customers
    .map((customer) => ({
      customer,
      score: scoreCustomerMatch(customer.name, spokenName)
    }))
    .sort((left, right) => right.score - left.score)[0];

  return bestMatch && bestMatch.score >= 0.6 ? bestMatch.customer.name : uppercaseSpanish(spokenName);
};

const sanitizeDerivedMeasurements = (
  transcript: string,
  parsed: ParsedVoiceAlbaran
): ParsedVoiceAlbaran => {
  return {
    ...parsed,
    items: parsed.items.map((item) => {
      if (item.pricingMode === "UNIT") return item;
      if (
        item.squareMeters != null &&
        dimensionPattern.test(item.description) &&
        !explicitSquareMetersPattern.test(transcript)
      ) {
        return { ...item, squareMeters: null };
      }
      return item;
    })
  };
};

const toCentimeters = (value: string, unit: string): number => {
  const parsed = Number.parseFloat(value.replace(",", "."));
  const normalizedUnit = normalizeText(unit);
  if (normalizedUnit === "mm" || normalizedUnit.startsWith("milimetro")) {
    return parsed / 10;
  }
  if (normalizedUnit === "m" || normalizedUnit.startsWith("metro")) {
    return parsed * 100;
  }
  return parsed;
};

const toMillimeters = (value: string, unit: string): number =>
  toCentimeters(value, unit) * 10;

const formatDimension = (value: number): string =>
  Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/\.?0+$/u, "").replace(".", ",");

const normalizeSpokenDimensions = (
  transcript: string,
  parsed: ParsedVoiceAlbaran
): ParsedVoiceAlbaran => {
  const matches = [
    ...transcript.matchAll(new RegExp(spokenDimensionPattern.source, "gi"))
  ];
  const normalizedDimensions = matches.flatMap((match) => {
    if (!match[1] || !match[3]) return [];
    const firstUnit = match[2] ?? match[4] ?? "mm";
    const secondUnit = match[4] ?? match[2] ?? "mm";
    const widthMm = toMillimeters(match[1], firstUnit);
    const heightMm = toMillimeters(match[3], secondUnit);
    if (
      !Number.isFinite(widthMm) ||
      !Number.isFinite(heightMm) ||
      widthMm <= 0 ||
      heightMm <= 0
    ) return [];
    return [{
      description: formatDimension(widthMm) + "X" + formatDimension(heightMm),
      widthMm,
      heightMm
    }];
  });
  if (normalizedDimensions.length === 0) return parsed;
  const unusedDimensionIndexes = new Set(
    normalizedDimensions.map((_dimension, index) => index)
  );

  return {
    ...parsed,
    items: parsed.items.map((item) => {
      if ((item.linearMeters ?? 0) > 0) return item;
      const hasDescriptionDimensions = descriptionDimensionPattern.test(item.description);
      const matchingAreaIndex = item.squareMeters == null
        ? -1
        : normalizedDimensions.findIndex((dimension, index) =>
            unusedDimensionIndexes.has(index) &&
            Math.abs(
              (dimension.widthMm * dimension.heightMm) / 1_000_000 -
              (item.squareMeters ?? 0)
            ) < 0.01
          );
      const dimensionIndex = matchingAreaIndex >= 0
        ? matchingAreaIndex
        : hasDescriptionDimensions
          ? [...unusedDimensionIndexes][0] ?? -1
          : -1;
      const normalizedDimension = dimensionIndex >= 0
        ? normalizedDimensions[dimensionIndex]
        : null;
      if (dimensionIndex >= 0) unusedDimensionIndexes.delete(dimensionIndex);
      return normalizedDimension
        ? {
            ...item,
            description: hasDescriptionDimensions
              ? item.description.replace(
                  descriptionDimensionPattern,
                  normalizedDimension.description
                )
              : item.description,
            widthMm: normalizedDimension.widthMm,
            heightMm: normalizedDimension.heightMm
          }
        : item;
    })
  };
};

export class ParseVoiceAlbaranUseCase {
  public constructor(
    private readonly parser: VoiceAlbaranParser,
    private readonly customerRepository: CustomerRepository
  ) {}

  public async execute(transcript: string): Promise<ParsedVoiceAlbaran> {
    const customers = await this.customerRepository.findAll();
    const specialPieceNames = specialPieceNamesForTranscript(transcript, customers);
    const parsed = await this.parser.parseTranscript(transcript, {
      customerNames: customers.map((customer) => customer.name),
      specialPieceNames
    });
    const sanitized = validateExplicitTranscriptEvidence(transcript, normalizeSpokenDimensions(
      transcript,
      sanitizeDerivedMeasurements(transcript, parsed)
    ));

    return {
      ...sanitized,
      customerName: resolveCustomerName(customers, sanitized.customerName)
    };
  }
}
