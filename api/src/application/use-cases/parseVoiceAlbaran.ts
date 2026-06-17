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

    return {
      ...parsed,
      customerName: resolveCustomerName(customers, parsed.customerName)
    };
  }
}
