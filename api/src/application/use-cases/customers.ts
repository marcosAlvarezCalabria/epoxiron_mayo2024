import type { CustomerInput } from "../../domain/entities/Customer.js";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { CustomerRepository } from "../../domain/repositories/CustomerRepository.js";
import type { CustomerSyncGateway } from "../../domain/ports/CustomerSyncGateway.js";

interface CustomerSyncConfig {
  enabled: boolean;
}

const syncFailure = () =>
  new DomainException(
    "No se pudo sincronizar el cliente con Odoo. No se ha aplicado el cambio en Epoxiron.",
    502
  );

const syncCustomer = async (
  gateway: CustomerSyncGateway,
  input: CustomerInput,
  externalPartnerId?: string | null
): Promise<string> => {
  try {
    return await gateway.syncCustomer(input, externalPartnerId);
  } catch (_error: unknown) {
    throw syncFailure();
  }
};

const setRemoteCustomerActive = async (
  gateway: CustomerSyncGateway,
  customer: Parameters<CustomerSyncGateway["setCustomerActive"]>[0],
  active: boolean
): Promise<void> => {
  try {
    await gateway.setCustomerActive(customer, active);
  } catch (_error: unknown) {
    throw syncFailure();
  }
};

const normalizeText = (value: string) => value.trim().toLowerCase();
const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const normalizeCustomerInput = (input: CustomerInput): CustomerInput => ({
  ...input,
  name: input.name.trim(),
  email: normalizeOptionalText(input.email),
  phone: normalizeOptionalText(input.phone),
  address: normalizeOptionalText(input.address),
  notes: normalizeOptionalText(input.notes),
  vat: normalizeOptionalText(input.vat)?.toUpperCase() ?? null,
  legalName: normalizeOptionalText(input.legalName),
  fiscalStreet: normalizeOptionalText(input.fiscalStreet),
  fiscalStreet2: normalizeOptionalText(input.fiscalStreet2),
  fiscalCity: normalizeOptionalText(input.fiscalCity),
  fiscalZip: normalizeOptionalText(input.fiscalZip),
  fiscalProvince: normalizeOptionalText(input.fiscalProvince),
  fiscalCountryCode:
    input.fiscalCountryCode === undefined
      ? undefined
      : normalizeOptionalText(input.fiscalCountryCode)?.toUpperCase() ?? null,
  paymentTermCode: normalizeOptionalText(input.paymentTermCode),
  externalPartnerId:
    input.externalPartnerId === undefined ? undefined : normalizeOptionalText(input.externalPartnerId)
});

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
  public constructor(
    private readonly repository: CustomerRepository,
    private readonly syncGateway?: CustomerSyncGateway,
    private readonly syncConfig: CustomerSyncConfig = { enabled: false }
  ) {}

  public async execute(input: CustomerInput) {
    const normalizedInput = normalizeCustomerInput(input);
    ensureUniqueSpecialPieceNames(normalizedInput);
    await ensureUniqueCustomer(this.repository, normalizedInput);
    const externalPartnerId =
      this.syncConfig.enabled && this.syncGateway
        ? await syncCustomer(this.syncGateway, normalizedInput)
        : null;
    return this.repository.create({ ...normalizedInput, externalPartnerId, active: true });
  }
}

export class UpdateCustomerUseCase {
  public constructor(
    private readonly repository: CustomerRepository,
    private readonly syncGateway?: CustomerSyncGateway,
    private readonly syncConfig: CustomerSyncConfig = { enabled: false }
  ) {}

  public async execute(id: string, input: CustomerInput) {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new DomainException("Cliente no encontrado", 404);
    }

    const normalizedInput = normalizeCustomerInput(input);
    ensureUniqueSpecialPieceNames(normalizedInput);
    await ensureUniqueCustomer(this.repository, normalizedInput, current.id);
    const externalPartnerId =
      this.syncConfig.enabled && this.syncGateway
        ? await syncCustomer(
            this.syncGateway,
            { ...normalizedInput, active: current.active !== false },
            current.externalPartnerId
          )
        : current.externalPartnerId;
    return this.repository.update(id, {
      ...normalizedInput,
      externalPartnerId,
      active: current.active !== false
    });
  }
}

export class DeleteCustomerUseCase {
  public constructor(
    private readonly repository: CustomerRepository,
    private readonly syncGateway?: CustomerSyncGateway,
    private readonly syncConfig: CustomerSyncConfig = { enabled: false }
  ) {}

  public async execute(id: string) {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new DomainException("Cliente no encontrado", 404);
    }

    if (current.active === false) {
      return;
    }

    if (this.syncConfig.enabled && this.syncGateway) {
      await setRemoteCustomerActive(this.syncGateway, current, false);
    }
    await this.repository.setActive(id, false);
  }
}

export class RestoreCustomerUseCase {
  public constructor(
    private readonly repository: CustomerRepository,
    private readonly syncGateway?: CustomerSyncGateway,
    private readonly syncConfig: CustomerSyncConfig = { enabled: false }
  ) {}

  public async execute(id: string) {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new DomainException("Cliente no encontrado", 404);
    }
    if (current.active !== false) {
      return current;
    }

    if (this.syncConfig.enabled && this.syncGateway) {
      await setRemoteCustomerActive(this.syncGateway, current, true);
    }
    return this.repository.setActive(id, true);
  }
}

export class GetCustomersUseCase {
  public constructor(private readonly repository: CustomerRepository) {}

  public async execute(search?: string, includeInactive = false) {
    return this.repository.findAll(search, includeInactive);
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
