import type { DeliveryNote, DeliveryNoteTexture } from "../entities/DeliveryNote.js";

const TEXTURE_LABELS: Record<DeliveryNoteTexture, string> = {
  NORMAL: "NORMAL",
  MATE: "MATE",
  TEXTURADO: "TEXTURADO",
  GOFRADO: "GOFRADO"
};

const normalizeEmbeddedValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

export const normalizeDeliveryNoteDescriptionInput = (value: string): string => {
  const separatorPattern = /\s*(?:\u00B7|Â·)\s*/gu;
  const trailingUnitPattern = /\s*(?:(?:\u00B7|Â·)\s*)?UNIDAD(?:ES)?\s*$/u;

  return value
    .toLocaleUpperCase("es-ES")
    .replace(separatorPattern, " · ")
    .replace(trailingUnitPattern, "")
    .replace(/\s+/g, " ")
    .trim();
};

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

const formatArticleTexture = (texture?: DeliveryNoteTexture) =>
  texture && texture !== "NORMAL" ? (TEXTURE_LABELS[texture] ?? texture) : null;

const descriptionContainsColor = (description: string, color: string) => {
  const normalizedDescription = normalizeEmbeddedValue(description);
  const normalizedColor = normalizeEmbeddedValue(color).replace(/^RAL\s+/g, "").replace(/\s+/g, "");

  if (!normalizedDescription || !normalizedColor) {
    return false;
  }

  return normalizedDescription.replace(/\s+/g, "").includes(normalizedColor);
};

const descriptionContainsTexture = (description: string, texture: DeliveryNoteTexture | undefined) => {
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

const formatDocumentNumber = (value: number) => value.toFixed(2).replace(".", ",");

export const buildDeliveryNoteItemDescription = (item: DeliveryNote["items"][number]) => {
  const normalizedDescription = normalizeDeliveryNoteDescriptionInput(item.description);
  const segments = [normalizedDescription];
  const texture = formatArticleTexture(item.texture);
  const keepsOriginalDimensions =
    descriptionContainsExplicitDimensions(normalizedDescription) || descriptionContainsCalculatedMeasures(normalizedDescription);

  if (item.color && !descriptionContainsColor(normalizedDescription, item.color)) {
    segments.push(item.color);
  }

  if (texture && !descriptionContainsTexture(normalizedDescription, item.texture)) {
    segments.push(texture);
  }

  if (item.pricingMode !== "UNIT" && !keepsOriginalDimensions) {
    if ((item.linearMeters ?? 0) > 0) {
      segments.push(`${formatDocumentNumber(item.linearMeters ?? 0)}MLIN`);
    }

    if ((item.squareMeters ?? 0) > 0) {
      segments.push(`${formatDocumentNumber(item.squareMeters ?? 0)}M2`);
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
