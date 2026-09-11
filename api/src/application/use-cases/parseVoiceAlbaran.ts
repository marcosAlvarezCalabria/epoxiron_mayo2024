import type { Customer } from "../../domain/entities/Customer.js";
import type { VoiceAlbaranParser, ParsedVoiceAlbaran } from "../../domain/ports/VoiceAlbaranParser.js";
import type { CustomerRepository } from "../../domain/repositories/CustomerRepository.js";

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
  /\b(\d+(?:[.,]\d+)?)\s*(mil[ií]metros?|mm|cent[ií]metros?|cm|metros?|m)?\s*(?:x|\*|por)\s*(\d+(?:[.,]\d+)?)\s*(mil[ií]metros?|mm|cent[ií]metros?|cm|metros?|m)\b/i;
const descriptionDimensionPattern =
  /\d+(?:[.,]\d+)?\s*(?:MM|CM|M)?\s*(?:X|\*|POR)\s*\d+(?:[.,]\d+)?\s*(?:MM|CM|M)?/i;

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
    if (!match[1] || !match[3] || !match[4]) return [];
    const firstUnit = match[2] ?? match[4];
    const widthCm = toCentimeters(match[1], firstUnit);
    const heightCm = toCentimeters(match[3], match[4]);
    if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm)) return [];
    return [`${formatDimension(widthCm)}X${formatDimension(heightCm)}`];
  });
  if (normalizedDimensions.length === 0) return parsed;
  let dimensionIndex = 0;

  return {
    ...parsed,
    items: parsed.items.map((item) => {
      if (!descriptionDimensionPattern.test(item.description)) return item;
      const normalizedDimension = normalizedDimensions[dimensionIndex];
      dimensionIndex += 1;
      return normalizedDimension
        ? {
            ...item,
            description: item.description.replace(
              descriptionDimensionPattern,
              normalizedDimension
            )
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
    const specialPieceNames = Array.from(
      new Set(
        customers.flatMap((customer) =>
          customer.specialPieces
            .map((piece) => piece.name.trim())
            .filter((pieceName) => pieceName.length > 0)
        )
      )
    ).slice(0, 200);
    const parsed = await this.parser.parseTranscript(transcript, {
      customerNames: customers.map((customer) => customer.name),
      specialPieceNames
    });
    const sanitized = normalizeSpokenDimensions(
      transcript,
      sanitizeDerivedMeasurements(transcript, parsed)
    );

    return {
      ...sanitized,
      customerName: resolveCustomerName(customers, sanitized.customerName)
    };
  }
}
