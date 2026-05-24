import type { CustomerInput } from "../../domain/entities/Customer.js";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { CustomerRepository } from "../../domain/repositories/CustomerRepository.js";

export class CreateCustomerUseCase {
  public constructor(private readonly repository: CustomerRepository) {}

  public async execute(input: CustomerInput) {
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
