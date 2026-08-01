import type { Customer, CustomerInput } from "../entities/Customer.js";

export interface CustomerRepository {
  findAll(search?: string, includeInactive?: boolean): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  findByName(name: string): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  create(input: CustomerInput): Promise<Customer>;
  update(id: string, input: CustomerInput): Promise<Customer>;
  setActive(id: string, active: boolean): Promise<Customer>;
}
