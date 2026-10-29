import type {
  OrderImageInput,
  OrderImageParser
} from "../../domain/ports/OrderImageParser.js";
import type { ParsedVoiceAlbaran } from "../../domain/ports/VoiceAlbaranParser.js";
import type { CustomerRepository } from "../../domain/repositories/CustomerRepository.js";
import { resolveCustomerName } from "./parseVoiceAlbaran.js";

export class ParseOrderImageUseCase {
  public constructor(
    private readonly parser: OrderImageParser,
    private readonly customerRepository: Pick<CustomerRepository, "findAll">,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(input: OrderImageInput): Promise<ParsedVoiceAlbaran> {
    const customers = await this.customerRepository.findAll();
    const parsed = await this.parser.parseImage(input, {
      customerNames: customers.map((customer) => customer.name),
      specialPieceNames: Array.from(new Set(customers.flatMap((customer) =>
        customer.specialPieces
          .map((piece) => piece.name.trim())
          .filter((name) => name.length > 0)
      ))).slice(0, 200)
    });

    return {
      ...parsed,
      date: this.now().toISOString().slice(0, 10),
      customerName: resolveCustomerName(customers, parsed.customerName)
    };
  }
}
