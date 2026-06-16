import type { DeliveryNoteItemFormState } from "@/components/delivery-notes/ItemFormSheet";
import type { Customer, DeliveryNotePricingMode, DeliveryNoteTexture } from "@/domain/entities";

export interface ParsedVoiceAlbaranItem {
  description: string;
  color: string | null;
  customUnitPrice: number | null;
  pricingMode: DeliveryNotePricingMode;
  texture: DeliveryNoteTexture;
  linearMeters: number | null;
  squareMeters: number | null;
  hasThickness: boolean;
  hasPrimer: boolean;
  saveAsSpecialPiece: boolean;
  quantity: number;
}

export interface ParsedVoiceAlbaranData {
  customerName: string | null;
  date: string;
  notes: string | null;
  items: ParsedVoiceAlbaranItem[];
}

export interface VoiceDraftPreviewItem {
  description: string | null;
  color: string | null;
  customUnitPrice: number | null;
  pricingMode: DeliveryNotePricingMode;
  texture: DeliveryNoteTexture | null;
  linearMeters: number | null;
  squareMeters: number | null;
  quantity: number | null;
}

export interface VoiceDraftPreview {
  customerName: string | null;
  items: VoiceDraftPreviewItem[];
}

const spokenNumbers = new Map<string, number>([
  ["un", 1],
  ["uno", 1],
  ["una", 1],
  ["dos", 2],
  ["tres", 3],
  ["cuatro", 4],
  ["cinco", 5],
  ["seis", 6],
  ["siete", 7],
  ["ocho", 8],
  ["nueve", 9],
  ["diez", 10],
  ["once", 11],
  ["doce", 12]
]);

const normalizeDecimal = (value: string): number | null => {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumericField = (value: number | null): string => {
  if (value == null) {
    return "";
  }

  return Number.isInteger(value) ? value.toString() : value.toString().replace(".", ",");
};

const normalizeLooseText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compactLooseText = (value: string): string => normalizeLooseText(value).replace(/\s+/g, "");

const normalizeSpecialPieceName = (value: string): string =>
  normalizeLooseText(value)
    .replace(/[+/_-]+/g, " ")
    .replace(/\bmas\b/g, " ")
    .replace(/\bk/g, "c")
    .replace(
      /\b(?:pieza|especial|incluir|incluye|incluida|incluido|guardar|como|pon|poner|mete|meter)\b/g,
      " "
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "");

const stripFillerWords = (value: string): string =>
  normalizeLooseText(value)
    .replace(
      /\b(?:eh|em|vale|pues|bueno|este|esta|es|el cliente es|cliente|para|vamos a poner|vamos a crear|vamos a meter|le vamos a poner|seguimos|seria|será|seria la|sería la|pieza que es|que es|la pieza es)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

const toTitleCase = (value: string): string =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const extractFirstNumber = (text: string): number | null => {
  const numericMatch = text.match(/(\d+(?:[.,]\d+)?)/);
  if (numericMatch?.[1]) {
    return normalizeDecimal(numericMatch[1]);
  }

  for (const [word, value] of spokenNumbers.entries()) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      return value;
    }
  }

  return null;
};

const extractTextureGuess = (text: string): DeliveryNoteTexture | null => {
  const normalized = normalizeLooseText(text);

  if (normalized.includes("textur")) {
    return "TEXTURADO";
  }

  if (normalized.includes("gofra")) {
    return "GOFRADO";
  }

  if (normalized.includes("mate")) {
    return "MATE";
  }

  if (normalized.includes("normal")) {
    return "NORMAL";
  }

  return null;
};

const extractRalGuess = (text: string): string | null => {
  const groupedMatches = Array.from(text.matchAll(/\d(?:[\d\s.,]*\d)?/g))
    .map((match) => match[0]?.replace(/\D/g, "") ?? "")
    .filter(Boolean);

  const preferredDigits =
    groupedMatches.find((digits) => digits.length === 4) ??
    groupedMatches.find((digits) => digits.length === 5 && digits[1] === "0") ??
    groupedMatches[0] ??
    "";

  if (!preferredDigits) {
    return null;
  }

  let digits = preferredDigits;
  if (digits.length === 5 && digits[1] === "0") {
    digits = `${digits[0]}${digits.slice(-3)}`;
  }

  if (digits.length < 4) {
    return null;
  }

  return `RAL ${digits.slice(0, 4)}`;
};

const extractQuantityGuess = (text: string): number | null => {
  const explicitQuantity =
    text.match(/(\d+(?:[.,]\d+)?)\s+unidad(?:es)?\b/i)?.[1] ??
    text.match(
      /\b(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+unidad(?:es)?\b/i
    )?.[1] ??
    null;

  if (!explicitQuantity) {
    return null;
  }

  return extractFirstNumber(explicitQuantity);
};

const extractLinearMetersGuess = (text: string): number | null => {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*metros?\s+lineales?\b/i);
  return match?.[1] ? normalizeDecimal(match[1]) : null;
};

const extractSquareMetersGuess = (text: string): number | null => {
  const explicitMatch = text.match(/(\d+(?:[.,]\d+)?)\s*m2\b/i);
  if (explicitMatch?.[1]) {
    return normalizeDecimal(explicitMatch[1]);
  }

  const dimensionMatches = Array.from(
    text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:x|\*|por)\s*(\d+(?:[.,]\d+)?)/gi)
  );

  if (dimensionMatches.length === 0) {
    return null;
  }

  const totalSquareMeters = dimensionMatches.reduce((sum, match) => {
    const width = normalizeDecimal(match[1] ?? "");
    const height = normalizeDecimal(match[2] ?? "");
    if (width == null || height == null) {
      return sum;
    }

    return sum + (width * height) / 1_000_000;
  }, 0);

  return totalSquareMeters > 0 ? Number.parseFloat(totalSquareMeters.toFixed(3)) : null;
};

const extractUnitPriceGuess = (text: string): number | null => {
  const match = text.match(
    /(?:a|por|precio(?:\s+de)?|vale|cuesta)?\s*(\d+(?:[.,]\d+)?)\s*euros?(?:\s+la\s+unidad|\s+por\s+unidad)?/i
  );

  return match?.[1] ? normalizeDecimal(match[1]) : null;
};

const cleanupDescriptionGuess = (value: string): string | null => {
  const cleaned = stripFillerWords(value)
    .replace(/\b(?:pieza|linea|línea)\b/g, " ")
    .replace(/\b(?:va a ser|será|seria|sería|va|ser)\b/g, " ")
    .replace(/\bde\b$/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  return toTitleCase(cleaned);
};

const extractDescriptionGuess = (text: string): string | null => {
  const normalized = normalizeLooseText(text);

  const namedAfterVerbMatch = normalized.match(
    /\b(?:se va a llamar|se llamara|se llamará|va a ser|sera|será)\s+([a-záéíóúñ][a-záéíóúñ\s-]*?)(?=\s+y\s+(?:va|vamos|le)\b|\s+(?:en|con)\b|\s+\d|\s+ral\b|$)/i
  );
  if (namedAfterVerbMatch?.[1]) {
    return cleanupDescriptionGuess(namedAfterVerbMatch[1]);
  }

  const explicitPieceMatch = normalized.match(
    /\bpieza\s+(?:va a ser|sera|será|seria|sería|es)?\s*(?:un|una)?\s*([a-záéíóúñ][a-záéíóúñ\s-]*?)(?=\s+y\s+(?:va|vamos|le)\b|\s+(?:en|con|por|a)\b|\s+\d|\s+ral\b|$)/i
  );
  if (explicitPieceMatch?.[1]) {
    return cleanupDescriptionGuess(explicitPieceMatch[1]);
  }

  const articleMatch = normalized.match(
    /\b(?:un|una|otro|otra)\s+([a-záéíóúñ][a-záéíóúñ\s-]*?)(?=\s+y\s+(?:va|vamos|le)\b|\s+(?:en|con|por|a)\b|\s+\d|\s+ral\b|$)/i
  );
  if (articleMatch?.[1]) {
    return cleanupDescriptionGuess(articleMatch[1]);
  }

  const namedPieceMatch = normalized.match(
    /\b(?:pieza|linea|línea)\s+(?:seria|sería|es)?\s*([a-záéíóúñ][a-záéíóúñ\s-]*?)(?=\s+y\s+(?:va|vamos|le)\b|\s+(?:en|con|por|a)\b|\s+\d|\s+ral\b|$)/i
  );
  if (namedPieceMatch?.[1]) {
    return cleanupDescriptionGuess(namedPieceMatch[1]);
  }

  const fallbackMatch = normalized.match(
    /\b([a-záéíóúñ][a-záéíóúñ\s-]{2,}?)(?=\s+y\s+(?:va|vamos|le)\b|\s+(?:en|con|por|a)\b|\s+\d|\s+ral\b|$)/i
  );

  return fallbackMatch?.[1] ? cleanupDescriptionGuess(fallbackMatch[1]) : null;
};

const normalizeCustomerName = (value: string | null): string => {
  if (!value) {
    return "";
  }

  return stripFillerWords(value)
    .replace(/\b(?:le|la|los|las)\b$/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const extractCustomerGuess = (text: string): string | null => {
  const explicitClientMatch = text.match(
    /\b(?:cliente|para)\s+(.*?)(?=\s+(?:vamos|con|en|y|una|un)\b|[,.]|$)/i
  );
  const normalized = normalizeCustomerName(explicitClientMatch?.[1] ?? null);
  return normalized ? toTitleCase(normalized) : null;
};

const splitTranscriptIntoItemSegments = (transcript: string): string[] => {
  const withMarkers = transcript.replace(
    /\b(?:siguiente(?:\s+linea|\s+línea)?|otra(?:s)?(?:\s+dos)?\s+lineas?|otra(?:s)?(?:\s+dos)?\s+líneas?|la\s+primera\s+seria|la\s+primera\s+sería|la\s+siguiente\s+seria|la\s+siguiente\s+sería|vamos a meter una pieza mas|vamos a meter una pieza más|una pieza mas|una pieza más)\b/gi,
    "|||"
  );

  return withMarkers
    .split("|||")
    .map((segment) => segment.trim())
    .filter((segment) =>
      /(?:\bun\b|\buna\b|\botro\b|\botra\b|\bmetros?\b|\bunidad(?:es)?\b|\bral\b|\d{4})/i.test(segment)
    );
};

export const buildVoiceDraftPreview = (transcript: string): VoiceDraftPreview => {
  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) {
    return { customerName: null, items: [] };
  }

  const customerName = extractCustomerGuess(normalizedTranscript);
  const items = splitTranscriptIntoItemSegments(normalizedTranscript)
    .map<VoiceDraftPreviewItem>((segment) => {
      const pricingMode: DeliveryNotePricingMode = /\b(?:por unidad|la unidad|precio por unidad|euros la unidad)\b/i.test(
        segment
      )
        ? "UNIT"
        : "DIMENSIONS";

      return {
        description: extractDescriptionGuess(segment),
        color: extractRalGuess(segment),
        customUnitPrice: pricingMode === "UNIT" ? extractUnitPriceGuess(segment) : null,
        pricingMode,
        texture: extractTextureGuess(segment),
        linearMeters: pricingMode === "DIMENSIONS" ? extractLinearMetersGuess(segment) : null,
        quantity: extractQuantityGuess(segment),
        squareMeters: pricingMode === "DIMENSIONS" ? extractSquareMetersGuess(segment) : null
      };
    })
    .filter(
      (item) =>
        item.description ||
        item.color ||
        item.quantity ||
        item.linearMeters != null ||
        item.squareMeters != null
    );

  return {
    customerName,
    items
  };
};

export const mapParsedVoiceItemToFormState = (
  item: ParsedVoiceAlbaranItem,
  customer?: Customer | null
): DeliveryNoteItemFormState => ({
  ...(() => {
    const normalizedDescription = normalizeSpecialPieceName(item.description);
    const matchedSpecialPiece =
      customer?.specialPieces.find((piece) => {
        const normalizedPieceName = normalizeSpecialPieceName(piece.name);
        if (!normalizedDescription || !normalizedPieceName) {
          return false;
        }

        return normalizedPieceName === normalizedDescription;
      }) ?? null;

    const usesExistingSpecialPiece = matchedSpecialPiece !== null;

    return {
      hasThickness: item.hasThickness,
      hasPrimer: item.hasPrimer,
      saveAsSpecialPiece: item.saveAsSpecialPiece || usesExistingSpecialPiece,
      customUnitPrice:
        usesExistingSpecialPiece
          ? formatNumericField(matchedSpecialPiece.price)
          : item.customUnitPrice != null
            ? formatNumericField(item.customUnitPrice)
            : "",
      description: usesExistingSpecialPiece ? matchedSpecialPiece.name : item.description.trim(),
      color: item.color?.trim() ?? "",
      pricingMode: usesExistingSpecialPiece ? "UNIT" : item.pricingMode,
      texture: item.texture,
      linearMeters:
        usesExistingSpecialPiece || item.pricingMode === "UNIT" ? "" : formatNumericField(item.linearMeters),
      quantity: item.quantity.toString(),
      squareMeters:
        usesExistingSpecialPiece || item.pricingMode === "UNIT" ? "" : formatNumericField(item.squareMeters)
    };
  })()
});

export const findCustomerByVoiceName = (
  customers: Customer[],
  customerName: string | null
): Customer | null => {
  const normalizedName = normalizeCustomerName(customerName);
  if (!normalizedName) {
    return null;
  }

  const exactMatch =
    customers.find((customer) => normalizeCustomerName(customer.name) === normalizedName) ?? null;

  if (exactMatch) {
    return exactMatch;
  }

  return (
    customers.find((customer) =>
      normalizeCustomerName(customer.name)
        .split(/\s+/)
        .some((word) => word.startsWith(normalizedName))
    ) ?? null
  );
};

export const buildVoiceFeedbackMessage = (
  data: ParsedVoiceAlbaranData,
  customer: Customer | null
): string | null => {
  const missingColorCount = data.items.filter((item) => !item.color?.trim()).length;

  if (data.customerName && !customer) {
    if (missingColorCount > 0) {
      return `Cliente no encontrado y ${missingColorCount} pieza(s) sin color. Revisa los datos antes de guardar.`;
    }

    return "Cliente no encontrado. Seleccionalo manualmente antes de guardar.";
  }

  if (missingColorCount > 0) {
    return `${missingColorCount} pieza(s) quedaron sin color. Revisalas antes de guardar.`;
  }

  return null;
};
