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
  pricePerLinearMeter: number;
  pricePerSquareMeter: number;
  minimumRate: number;
  grosorMm: number | null;
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
  pricePerLinearMeter: number;
  pricePerSquareMeter: number;
  minimumRate: number;
  grosorMm?: number | null;
  grosorPrecio?: number | null;
  specialPieces: SpecialPiece[];
}

