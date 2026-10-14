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

export const normalizeDeliveryNoteDescriptionInput = (value: string): string => {
  const separatorPattern = /\s*(?:\u00B7|Â·)\s*/gu;
  const unitWordPattern = /\bUNIDAD(?:ES)?\b/gu;
  const ralPrefixPattern = /\bRAL\s+(?=\d)/gu;

  return value
    .toLocaleUpperCase("es-ES")
    .replace(/\bTEXTUR(?:IZADO|IZADA|ARO|ADA)\b/gu, "TEXTURADO")
    .replace(separatorPattern, " · ")
    .replace(ralPrefixPattern, "")
    .replace(unitWordPattern, "")
    .replace(/\s*·\s*·\s*/gu, " · ")
    .replace(/\s*·\s*$/u, "")
    .replace(/\s+/g, " ")
    .replace(/\s*·\s*/gu, " · ")
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

export const inferEmbeddedColorAndTexture = (
  description: string
): { color: string | null; texture: DeliveryNoteTexture | null } => {
  const normalized = normalizeEmbeddedValue(description);
  const rawColor = normalized.match(/\b\d{4}(?:\s*\+\s*\d{4})*\b/)?.[0] ?? null;
  const color = rawColor ? `RAL ${rawColor.replace(/\s+/g, "")}` : null;

  if (/\bTEXT(?:URADO)?\b/.test(normalized)) {
    return { color, texture: "TEXTURADO" };
  }

  if (/\bGOF(?:RADO)?\b/.test(normalized)) {
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
      return /\bGOF(?:RADO)?\b/.test(normalizedDescription);
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
  "description" | "color" | "texture" | "pricingMode" | "linearMeters" | "squareMeters" | "widthMm" | "heightMm" | "thickness" | "primer"
>;

const formatMillimeters = (value: number) =>
  Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/u, "");

const normalizeRenderedColor = (value: string) => value.replace(/^RAL\s+/u, "").trim();

const escapeRegularExpression = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const trailingDimensionsPattern =
  /\b\d+(?:[.,]\d+)?(?:\s*(?:X|\*)\s*\d+(?:[.,]\d+)?)+(?:\s*MM)?(?:\s*\+\s*\d+(?:[.,]\d+)?(?:\s*(?:X|\*)\s*\d+(?:[.,]\d+)?)+(?:\s*MM)?)*$/u;

const embeddedLinearMeasurePattern =
  /\b\d+(?:[.,]\d+)?\s*(?:MLIN|M\s*LINEAL(?:ES)?|METROS?\s+LINEALES?|M)\b/gu;
const bareLinearMeasurePattern = /\b\d+(?:[.,]\d+)?\s*M\b/u;

const removeEmbeddedTexture = (description: string, texture?: DeliveryNoteTexture) => {
  switch (texture) {
    case "TEXTURADO":
      return description.replace(/\bTEXT(?:UR(?:ADO|IZADO|ARO))?\b/gu, " ");
    case "GOFRADO":
      return description.replace(/\bGOF(?:RADO)?\b/gu, " ");
    case "MATE":
      return description.replace(/\bMATE\b/gu, " ");
    default:
      return description;
  }
};

const embeddedTextureLabel = (
  description: string,
  texture?: DeliveryNoteTexture
): string | null => {
  switch (texture) {
    case "TEXTURADO":
      return description.match(/\bTEXT(?:UR(?:ADO|IZADO|ARO))?\b/u)?.[0] ?? null;
    case "GOFRADO":
      return description.match(/\bGOF(?:RADO)?\b/u)?.[0] ?? null;
    case "MATE":
      return description.match(/\bMATE\b/u)?.[0] ?? null;
    default:
      return null;
  }
};

const canonicalizeCommercialDescription = (
  description: string,
  color: string,
  texture: DeliveryNoteTexture | undefined,
  linearMeters: number | null | undefined
) => {
  let workingDescription = description.replace(/\s*·\s*/gu, " ").trim();
  const originalTextureLabel = embeddedTextureLabel(workingDescription, texture);
  const dimensionsMatch = workingDescription.match(trailingDimensionsPattern);
  const hasBareLinearMeasure =
    (linearMeters ?? 0) > 0 &&
    bareLinearMeasurePattern.test(workingDescription) &&
    !descriptionContainsCalculatedMeasures(workingDescription);

  if (!dimensionsMatch && !hasBareLinearMeasure) {
    return description;
  }

  if (hasBareLinearMeasure) {
    workingDescription = workingDescription.replace(embeddedLinearMeasurePattern, " ");
  }

  const dimensions = dimensionsMatch?.[0].replace(/\s+/gu, "") ?? null;

  if (dimensionsMatch?.index != null) {
    workingDescription = workingDescription.slice(0, dimensionsMatch.index);
  }

  const renderedColor = normalizeRenderedColor(color);
  let renderedColorSegment: string | null = renderedColor || null;
  if (renderedColor) {
    const colorPattern = new RegExp(
      `(^|\\s)${escapeRegularExpression(renderedColor)}(?=\\s|$)`,
      "gu"
    );
    if (colorPattern.test(workingDescription)) {
      colorPattern.lastIndex = 0;
      workingDescription = workingDescription.replace(colorPattern, "$1");
    } else if (descriptionContainsColor(workingDescription, color)) {
      renderedColorSegment = null;
    }
  }

  workingDescription = removeEmbeddedTexture(workingDescription, texture)
    .replace(/\s+/gu, " ")
    .trim();

  return [
    workingDescription,
    renderedColorSegment,
    originalTextureLabel ?? (
      texture && texture !== "NORMAL" ? formatDeliveryNoteTexture(texture) : null
    ),
    dimensions
  ].filter(Boolean).join(" ");
};

export const buildDeliveryNoteItemDescription = (item: DeliveryNoteItemLike) => {
  const normalizedDescription = canonicalizeCommercialDescription(
    normalizeDeliveryNoteDescriptionInput(item.description),
    item.color,
    item.texture,
    item.linearMeters
  );
  const segments = [normalizedDescription];
  const texture = item.texture && item.texture !== "NORMAL" ? formatDeliveryNoteTexture(item.texture) : null;
  const pricingMode: DeliveryNotePricingMode = item.pricingMode ?? "DIMENSIONS";
  const keepsOriginalDimensions = descriptionContainsExplicitDimensions(normalizedDescription);
  const keepsOriginalCalculatedMeasures = descriptionContainsCalculatedMeasures(normalizedDescription);

  if (item.color && !descriptionContainsColor(normalizedDescription, item.color)) {
    segments.push(normalizeRenderedColor(item.color));
  }

  if (texture && !descriptionContainsTexture(normalizedDescription, item.texture)) {
    segments.push(texture);
  }

  if (pricingMode !== "UNIT") {
    if ((item.linearMeters ?? 0) > 0 && !keepsOriginalCalculatedMeasures) {
      segments.push(`${formatMetersSummary(item.linearMeters)}MLIN`);
    }

    if (!keepsOriginalDimensions && (item.widthMm ?? 0) > 0 && (item.heightMm ?? 0) > 0) {
      segments.push(
        `${formatMillimeters(item.widthMm ?? 0)}X${formatMillimeters(item.heightMm ?? 0)}MM`
      );
    } else if (!keepsOriginalDimensions && (item.squareMeters ?? 0) > 0) {
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
