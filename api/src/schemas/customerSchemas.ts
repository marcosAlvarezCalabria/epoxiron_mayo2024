import { z } from "zod";

export const specialPieceSchema = z.object({
  name: z.string().min(1),
  price: z.coerce.number().nonnegative()
});

export const customerInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  pricePerLinearMeter: z.coerce.number().nonnegative(),
  pricePerSquareMeter: z.coerce.number().nonnegative(),
  minimumRate: z.coerce.number().nonnegative(),
  grosorMm: z.coerce.number().positive().nullable().optional(),
  grosorPrecio: z.coerce.number().nonnegative().nullable().optional(),
  specialPieces: z.array(specialPieceSchema).default([])
});

