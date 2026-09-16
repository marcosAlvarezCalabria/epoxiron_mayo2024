export const SPECIAL_DELIVERY_NOTE_COLORS = [
  "ORO ENVEJECIDO ESMERILADO",
  "ORO V200",
  "ESMERILADO",
  "ORO"
] as const;

const normalizeComparableColor = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-ES")
    .replace(/\s+/g, " ")
    .trim();

export const findSpecialDeliveryNoteColor = (value: string): string | null => {
  const normalized = normalizeComparableColor(value);
  return SPECIAL_DELIVERY_NOTE_COLORS.find((color) =>
    new RegExp(`\\b${color.replace(/\s+/g, "\\s+")}\\b`, "u").test(normalized)
  ) ?? null;
};

export const normalizeDeliveryNoteColor = (value: string | null): string | null => {
  if (!value?.trim()) return null;

  const normalized = normalizeComparableColor(value);
  const withoutRalPrefix = normalized.replace(/^RAL\s*/u, "");
  const specialColor = SPECIAL_DELIVERY_NOTE_COLORS.find(
    (color) => color === withoutRalPrefix
  );
  if (specialColor) return specialColor;

  if (/^(?:NEGRO|NEGRA)$/u.test(normalized)) return "RAL 9005";
  if (/^(?:BLANCO|BLANCA)$/u.test(normalized)) return "RAL 9010";

  if (/^[\d\s]+$/u.test(withoutRalPrefix)) {
    const numericCandidate = withoutRalPrefix.replace(/\D/g, "");
    if (numericCandidate.length === 4) return `RAL ${numericCandidate}`;
    if (numericCandidate.length === 5 && numericCandidate[1] === "0") {
      return `RAL ${numericCandidate[0]}${numericCandidate.slice(-3)}`;
    }
    return null;
  }

  const ral = normalized.match(/^RAL\s*(\d{4})$/u);
  if (ral?.[1]) return `RAL ${ral[1]}`;

  return normalized;
};
