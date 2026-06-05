import { z } from "zod";

const deliveryNoteTextureSchema = z.enum(["NORMAL", "MATE", "TEXTURADO", "GOFRADO"]);

export const deliveryNoteItemDraftSchema = z.object({
  description: z.string().min(1),
  color: z.string().min(1),
  texture: deliveryNoteTextureSchema.optional().default("NORMAL"),
  linearMeters: z.coerce.number().positive().nullable().optional(),
  squareMeters: z.coerce.number().positive().nullable().optional(),
  thickness: z.coerce.number().positive().nullable().optional(),
  primer: z.boolean().optional(),
  saveAsSpecialPiece: z.boolean().optional(),
  quantity: z.coerce.number().int().positive()
});

export const deliveryNoteInputSchema = z.object({
  customerId: z.string().uuid(),
  notes: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "PENDING", "REVIEWED"]),
  date: z.coerce.date().optional(),
  items: z.array(deliveryNoteItemDraftSchema).min(1)
});

export const deliveryNoteStatusSchema = z.object({
  status: z.enum(["DRAFT", "PENDING", "REVIEWED"])
});

export const calculatePriceSchema = z.object({
  customerId: z.string().uuid(),
  item: deliveryNoteItemDraftSchema
});

export const sendDailyDeliveryNotesReportSchema = z.object({
  date: z.coerce.date().optional(),
  email: z.string().email().optional()
});
