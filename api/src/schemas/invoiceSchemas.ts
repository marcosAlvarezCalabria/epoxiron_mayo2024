import { z } from "zod";

export const invoiceLocalStateSchema = z.enum([
  "CREATING",
  "CREATED_REMOTE",
  "LINKED",
  "RECONCILING",
  "FAILED"
]);
export const verifactuStateSchema = z.enum([
  "NOT_SENT",
  "PENDING",
  "ACCEPTED",
  "REJECTED"
]);

export const createInvoiceSchema = z
  .object({
    deliveryNoteIds: z.array(z.string().uuid()).min(1).max(100),
    confirmed: z.literal(true),
    previewToken: z.string().min(64).max(4096)
  })
  .strict()
  .refine((value) => new Set(value.deliveryNoteIds).size === value.deliveryNoteIds.length, {
    message: "No se permiten albaranes duplicados",
    path: ["deliveryNoteIds"]
  });

export const previewInvoiceSchema = z
  .object({
    deliveryNoteIds: z.array(z.string().uuid()).min(1).max(100)
  })
  .strict()
  .refine((value) => new Set(value.deliveryNoteIds).size === value.deliveryNoteIds.length, {
    message: "No se permiten albaranes duplicados",
    path: ["deliveryNoteIds"]
  });

export const listInvoicesQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  localState: invoiceLocalStateSchema.optional(),
  verifactuState: verifactuStateSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
  offset: z.coerce.number().int().nonnegative().default(0)
});
