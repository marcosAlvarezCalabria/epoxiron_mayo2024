export interface SpecialPiece {
  id?: string;
  name: string;
  price: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  vat: string | null;
  legalName: string | null;
  fiscalStreet: string | null;
  fiscalStreet2: string | null;
  fiscalCity: string | null;
  fiscalZip: string | null;
  fiscalProvince: string | null;
  fiscalCountryCode: string | null;
  paymentTermCode: string | null;
  externalPartnerId: string | null;
  active: boolean;
  pricePerLinearMeter: number;
  pricePerSquareMeter: number;
  minimumRate: number;
  grosorPrecio: number | null;
  specialPieces: SpecialPiece[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  vat?: string | null;
  legalName?: string | null;
  fiscalStreet?: string | null;
  fiscalStreet2?: string | null;
  fiscalCity?: string | null;
  fiscalZip?: string | null;
  fiscalProvince?: string | null;
  fiscalCountryCode?: string | null;
  paymentTermCode?: string | null;
  externalPartnerId?: string | null;
  active?: boolean;
  pricePerLinearMeter: number;
  pricePerSquareMeter: number;
  minimumRate: number;
  grosorPrecio?: number | null;
  specialPieces: SpecialPiece[];
}

export type FiscalDataIssue =
  | "MISSING_LEGAL_NAME"
  | "MISSING_VAT"
  | "MISSING_STREET"
  | "MISSING_CITY"
  | "MISSING_ZIP"
  | "MISSING_COUNTRY";

const isBlank = (value: string | null | undefined): boolean => !value?.trim();

export const validateFiscalCustomer = (customer: Customer): FiscalDataIssue[] => {
  const issues: FiscalDataIssue[] = [];

  if (isBlank(customer.legalName)) issues.push("MISSING_LEGAL_NAME");
  if (isBlank(customer.vat)) issues.push("MISSING_VAT");
  if (isBlank(customer.fiscalStreet)) issues.push("MISSING_STREET");
  if (isBlank(customer.fiscalCity)) issues.push("MISSING_CITY");
  if (isBlank(customer.fiscalZip)) issues.push("MISSING_ZIP");
  if (isBlank(customer.fiscalCountryCode)) issues.push("MISSING_COUNTRY");

  return issues;
};
