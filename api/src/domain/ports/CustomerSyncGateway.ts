import type { Customer, CustomerInput } from "../entities/Customer.js";

export interface CustomerSyncGateway {
  syncCustomer(input: CustomerInput, externalPartnerId?: string | null): Promise<string>;
  setCustomerActive(customer: Customer, active: boolean): Promise<void>;
}
