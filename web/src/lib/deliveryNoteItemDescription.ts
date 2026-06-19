import { formatDeliveryNoteTexture } from "@/constants/deliveryNoteTextures";
import type {
  DeliveryNoteItem,
  DeliveryNoteItemDraft,
  DeliveryNotePricingMode,
  DeliveryNoteTexture
} from "@/domain/entities";
import { formatMetersSummary, formatSquareMetersSummary } from "@/lib/measurements";

const normalizeEmbeddedValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

export const normalizeSpecialPieceName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[+/_-]+/g, " ")
    .replace(/\bmas\b/g, " ")
    .replace(/\bk/g, "c")
    .replace(
      /\b(?:pieza|especial|incluir|incluye|incluida|incluido|guardar|como|pon|poner|mete|meter)\b/g,
      " "
    )
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, "")
    .trim();

export const inferEmbeddedColorAndTexture = (
  description: string
): { color: string | null; texture: DeliveryNoteTexture | null } => {
  const normalized = normalizeEmbeddedValue(description);
  const rawColor = normalized.match(/\b\d{4}(?:\s*\+\s*\d{4})*\b/)?.[0] ?? null;
  const color = rawColor ? `RAL ${rawColor.replace(/\s+/g, "")}` : null;

  if (/\bTEXT(?:URADO)?\b/.test(normalized)) {
    return { color, texture: "TEXTURADO" };
  }

  if (/\bGOFRADO\b/.test(normalized)) {
    return { color, texture: "GOFRADO" };
  }

  if (/\bMATE\b/.test(normalized)) {
    return { color, texture: "MATE" };
  }

  return { color, texture: null };
};

export const descriptionContainsColor = (description: string, color: string) => {
  const normalizedDescription = normalizeEmbeddedValue(description);
  const normalizedColor = normalizeEmbeddedValue(color).replace(/^RAL\s+/g, "").replace(/\s+/g, "");

  if (!normalizedDescription || !normalizedColor) {
    return false;
  }

  return normalizedDescription.replace(/\s+/g, "").includes(normalizedColor);
};

export const descriptionContainsTexture = (
  description: string,
  texture: DeliveryNoteTexture | undefined
) => {
  if (!texture || texture === "NORMAL") {
    return false;
  }

  const normalizedDescription = normalizeEmbeddedValue(description);

  switch (texture) {
    case "TEXTURADO":
      return /\bTEXT(?:URADO)?\b/.test(normalizedDescription);
    case "GOFRADO":
      return /\bGOFRADO\b/.test(normalizedDescription);
    case "MATE":
      return /\bMATE\b/.test(normalizedDescription);
    default:
      return false;
  }
};

const descriptionContainsExplicitDimensions = (description: string) => {
  const normalizedDescription = normalizeEmbeddedValue(description);

  return /\b\d+(?:[.,]\d+)?\s*(?:X|\*)\s*\d+(?:[.,]\d+)?\b/.test(normalizedDescription) ||
    /\b\d+(?:[.,]\d+)?\s+POR\s+\d+(?:[.,]\d+)?\b/.test(normalizedDescription);
};

const descriptionContainsCalculatedMeasures = (description: string) => {
  const normalizedDescription = normalizeEmbeddedValue(description);

  return /\b\d+(?:[.,]\d+)?\s*MLIN\b/.test(normalizedDescription) ||
    /\b\d+(?:[.,]\d+)?\s*M2\b/.test(normalizedDescription);
};

type DeliveryNoteItemLike = Pick<
  DeliveryNoteItem | DeliveryNoteItemDraft,
  "description" | "color" | "texture" | "pricingMode" | "linearMeters" | "squareMeters" | "thickness" | "primer"
>;

export const buildDeliveryNoteItemDescription = (item: DeliveryNoteItemLike) => {
  const segments = [item.description];
  const texture = item.texture && item.texture !== "NORMAL" ? formatDeliveryNoteTexture(item.texture) : null;
  const pricingMode: DeliveryNotePricingMode = item.pricingMode ?? "DIMENSIONS";
  const keepsOriginalDimensions =
    descriptionContainsExplicitDimensions(item.description) || descriptionContainsCalculatedMeasures(item.description);

  if (item.color && !descriptionContainsColor(item.description, item.color)) {
    segments.push(item.color);
  }

  if (texture && !descriptionContainsTexture(item.description, item.texture)) {
    segments.push(texture);
  }

  if (pricingMode === "UNIT") {
    segments.push("UNIDAD");
  } else if (!keepsOriginalDimensions) {
    if ((item.linearMeters ?? 0) > 0) {
      segments.push(`${formatMetersSummary(item.linearMeters)}MLIN`);
    }

    if ((item.squareMeters ?? 0) > 0) {
      segments.push(`${formatSquareMetersSummary(item.squareMeters)}M2`);
    }
  }

  if (item.thickness != null) {
    segments.push("G");
  }

  if (item.primer) {
    segments.push("I");
  }

  return segments.filter(Boolean).join(" · ");
};
