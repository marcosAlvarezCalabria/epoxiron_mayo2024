import { z } from "zod";
import { DomainException } from "../domain/exceptions/DomainException.js";
import type { ParsedVoiceAlbaran } from "../domain/ports/VoiceAlbaranParser.js";

const parsedVoiceTextureSchema = z.enum(["NORMAL", "MATE", "TEXTURADO", "GOFRADO"]);
const parsedVoicePricingModeSchema = z.enum(["DIMENSIONS", "UNIT"]);
const uppercaseSpanish = (value: string): string => value.toLocaleUpperCase("es-ES").trim();

export const parseVoiceAlbaranRequestSchema = z.object({
  transcript: z.string().trim().min(1)
});

const llmTextureSchema = z
  .string()
  .trim()
  .toLowerCase()
  .nullable()
  .transform((value) => {
    if (value === null || value === "normal") {
      return "NORMAL" as const;
    }

    if (value === "mate") {
      return "MATE" as const;
    }

    if (value === "texturado") {
      return "TEXTURADO" as const;
    }

    if (value === "gofrado") {
      return "GOFRADO" as const;
    }

    throw new DomainException("No se pudo interpretar el texto", 422);
  });

const llmNumberSchema = z
  .union([z.number(), z.string().trim(), z.null()])
  .transform((value) => {
    if (value === null) {
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (!value) {
      return null;
    }

    const normalized = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : null;
  });

const llmBooleanSchema = z
  .union([z.boolean(), z.string().trim().toLowerCase(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value > 0;
    }

    if (typeof value === "string") {
      return ["true", "1", "si", "sí", "yes"].includes(value);
    }

    return false;
  });

const normalizeVoiceColor = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numericCandidate = trimmed.replace(/\D/g, "");
  if (numericCandidate) {
    if (numericCandidate.length === 4) {
      return `RAL ${numericCandidate}`;
    }

    if (numericCandidate.length === 5 && numericCandidate[1] === "0") {
      return `RAL ${numericCandidate[0]}${numericCandidate.slice(-3)}`;
    }

    return null;
  }

  return trimmed;
};

const normalizeVoiceText = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? uppercaseSpanish(trimmed) : null;
};

const llmItemSchema = z.object({
  description: z.string().trim().min(1),
  color: z.string().trim().min(1).nullable(),
  specialPieceIntent: llmBooleanSchema.optional().default(false),
  pricingMode: z
    .string()
    .trim()
    .toLowerCase()
    .nullable()
    .optional()
    .transform((value) => (value === "unit" ? "UNIT" as const : "DIMENSIONS" as const)),
  customUnitPrice: llmNumberSchema.optional().default(null),
  texture: llmTextureSchema,
  linearMeters: llmNumberSchema.optional().default(null),
  squareMeters: llmNumberSchema.optional().default(null),
  thickness: llmNumberSchema.optional().default(null),
  hasThickness: llmBooleanSchema.optional().default(false),
  hasPrimer: llmBooleanSchema.optional().default(false),
  saveAsSpecialPiece: llmBooleanSchema.optional().default(false),
  primer: llmBooleanSchema.optional().default(false),
  quantity: z
    .union([z.number().int(), z.string().trim()])
    .transform((value) => {
      const parsedValue =
        typeof value === "number" ? value : Number.parseInt(value || "1", 10);

      if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        return 1;
      }

      return parsedValue;
    })
});

const llmParsedVoiceAlbaranSchema = z.object({
  customerName: z.string().trim().min(1).nullable(),
  date: z.string().trim().min(1),
  notes: z.string().trim().min(1).nullable(),
  items: z.array(llmItemSchema)
});

const parsedVoiceAlbaranResponseSchema = z.object({
  customerName: z.string().trim().min(1).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().min(1).nullable(),
  items: z.array(
    z.object({
      description: z.string().trim().min(1),
      color: z.string().trim().min(1).nullable(),
      specialPieceIntent: z.boolean(),
      pricingMode: parsedVoicePricingModeSchema,
      customUnitPrice: z.number().positive().nullable(),
      texture: parsedVoiceTextureSchema,
      linearMeters: z.number().positive().nullable(),
      squareMeters: z.number().positive().nullable(),
      hasThickness: z.boolean(),
      hasPrimer: z.boolean(),
      saveAsSpecialPiece: z.boolean(),
      quantity: z.number().int().positive()
    })
  )
});

export const normalizeParsedVoiceAlbaran = (rawValue: unknown): ParsedVoiceAlbaran => {
  const parsed = llmParsedVoiceAlbaranSchema.parse(rawValue);

  const items = parsed.items
    .map((item) => ({
      effectivePricingMode:
        item.pricingMode === "UNIT" &&
        (item.customUnitPrice == null || item.customUnitPrice <= 0) &&
        ((item.linearMeters != null && item.linearMeters > 0) ||
          (item.squareMeters != null && item.squareMeters > 0))
          ? "DIMENSIONS"
          : item.pricingMode,
      color: normalizeVoiceColor(item.color),
      customUnitPrice:
        item.pricingMode === "UNIT" && item.customUnitPrice && item.customUnitPrice > 0
          ? item.customUnitPrice
          : null,
      description: uppercaseSpanish(item.description),
      hasPrimer: item.hasPrimer || item.primer,
      hasThickness: item.hasThickness || (item.thickness != null && item.thickness > 0),
      linearMeters: item.linearMeters && item.linearMeters > 0 ? item.linearMeters : null,
      quantity: item.quantity,
      saveAsSpecialPiece: item.saveAsSpecialPiece,
      specialPieceIntent: item.specialPieceIntent,
      squareMeters: item.squareMeters && item.squareMeters > 0 ? item.squareMeters : null,
      texture: item.texture
    }))
    .map((item) => ({
      color: item.color,
      customUnitPrice: item.effectivePricingMode === "UNIT" ? item.customUnitPrice : null,
      description: item.description,
      hasPrimer: item.hasPrimer,
      hasThickness: item.hasThickness,
      linearMeters: item.linearMeters,
      pricingMode: item.effectivePricingMode,
      quantity: item.quantity,
      saveAsSpecialPiece: item.saveAsSpecialPiece,
      specialPieceIntent: item.specialPieceIntent,
      squareMeters: item.squareMeters,
      texture: item.texture
    }))
    .filter((item) => item.description.trim().length > 0);

  if (items.length === 0) {
    throw new DomainException("No se pudo interpretar el texto", 422);
  }

  const date = new Date(parsed.date);
  if (Number.isNaN(date.getTime())) {
    throw new DomainException("No se pudo interpretar el texto", 422);
  }

  return parsedVoiceAlbaranResponseSchema.parse({
    customerName: normalizeVoiceText(parsed.customerName),
    date: date.toISOString().slice(0, 10),
    items,
    notes: normalizeVoiceText(parsed.notes)
  });
};
