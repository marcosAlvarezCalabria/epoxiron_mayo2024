import type { CustomerInput } from "../../domain/entities/Customer.js";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { CustomerRepository } from "../../domain/repositories/CustomerRepository.js";

const normalizeText = (value: string) => value.trim().toLowerCase();

const ensureUniqueSpecialPieceNames = (input: CustomerInput) => {
  const seen = new Set<string>();

  for (const piece of input.specialPieces) {
    const normalizedName = normalizeText(piece.name);
    if (!normalizedName) {
      continue;
    }

    if (seen.has(normalizedName)) {
      throw new DomainException(
        "No puede haber piezas especiales con el mismo nombre para un cliente",
        409
      );
    }

    seen.add(normalizedName);
  }
};

const ensureUniqueCustomer = async (
  repository: CustomerRepository,
  input: CustomerInput,
  currentCustomerId?: string
) => {
  const customerByName = await repository.findByName(input.name.trim());
  if (customerByName && customerByName.id !== currentCustomerId) {
    throw new DomainException("Ya existe un cliente con ese nombre", 409);
  }

  const normalizedEmail = input.email?.trim();
  if (!normalizedEmail) {
    return;
  }

  const customerByEmail = await repository.findByEmail(normalizedEmail);
  if (
    customerByEmail &&
    customerByEmail.id !== currentCustomerId &&
    customerByEmail.email &&
    normalizeText(customerByEmail.email) === normalizeText(normalizedEmail)
  ) {
    throw new DomainException("Ya existe un cliente con ese correo", 409);
  }
};

export class CreateCustomerUseCase {
  public constructor(private readonly repository: CustomerRepository) {}

  public async execute(input: CustomerInput) {
    ensureUniqueSpecialPieceNames(input);
    await ensureUniqueCustomer(this.repository, input);
    return this.repository.create(input);
  }
}

export class UpdateCustomerUseCase {
  public constructor(private readonly repository: CustomerRepository) {}

  public async execute(id: string, input: CustomerInput) {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new DomainException("Cliente no encontrado", 404);
    }

    ensureUniqueSpecialPieceNames(input);
    await ensureUniqueCustomer(this.repository, input, current.id);
    return this.repository.update(id, input);
  }
}

export class DeleteCustomerUseCase {
  public constructor(private readonly repository: CustomerRepository) {}

  public async execute(id: string) {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new DomainException("Cliente no encontrado", 404);
    }

    const hasDeliveryNotes = await this.repository.hasDeliveryNotes(id);
    if (hasDeliveryNotes) {
      throw new DomainException("No se puede eliminar un cliente con albaranes asociados", 409);
    }

    await this.repository.delete(id);
  }
}

export class GetCustomersUseCase {
  public constructor(private readonly repository: CustomerRepository) {}

  public async execute(search?: string) {
    return this.repository.findAll(search);
  }
}

export class GetCustomerUseCase {
  public constructor(private readonly repository: CustomerRepository) {}

  public async execute(id: string) {
    const customer = await this.repository.findById(id);
    if (!customer) {
      throw new DomainException("Cliente no encontrado", 404);
    }

    return customer;
  }
}
