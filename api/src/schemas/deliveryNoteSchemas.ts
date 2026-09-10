import { z } from "zod";
import { normalizeDeliveryNoteDescriptionInput } from "../domain/services/deliveryNoteItemDescription.js";

const deliveryNoteTextureSchema = z.enum(["NORMAL", "MATE", "TEXTURADO", "GOFRADO"]);
const deliveryNotePricingModeSchema = z.enum(["DIMENSIONS", "UNIT"]);

export const deliveryNoteItemDraftSchema = z.object({
  description: z.string().min(1).transform((value) => normalizeDeliveryNoteDescriptionInput(value)),
  color: z.string().min(1),
  texture: deliveryNoteTextureSchema.optional().default("NORMAL"),
  pricingMode: deliveryNotePricingModeSchema.optional().default("DIMENSIONS"),
  customUnitPrice: z.coerce.number().positive().nullable().optional(),
  linearMeters: z.coerce.number().positive().nullable().optional(),
  squareMeters: z.coerce.number().positive().nullable().optional(),
  widthMm: z.coerce.number().positive().nullable().optional(),
  heightMm: z.coerce.number().positive().nullable().optional(),
  thickness: z.coerce.number().positive().nullable().optional(),
  primer: z.boolean().optional(),
  saveAsSpecialPiece: z.boolean().optional(),
  quantity: z.coerce.number().int().min(1).max(1000)
}).superRefine((item, context) => {
  if ((item.widthMm == null) !== (item.heightMm == null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El ancho y el alto en milímetros deben indicarse juntos",
      path: item.widthMm == null ? ["widthMm"] : ["heightMm"]
    });
  }
}).transform((item) => ({
  ...item,
  squareMeters:
    item.widthMm != null && item.heightMm != null
      ? (item.widthMm * item.heightMm) / 1_000_000
      : item.squareMeters
}));

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
  date: z.coerce.date().optional()
});
