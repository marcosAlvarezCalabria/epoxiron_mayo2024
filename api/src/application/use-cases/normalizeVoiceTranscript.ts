const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

export const normalizeVoiceTranscript = (transcript: string): string => {
  let normalized = transcript;

  normalized = normalized
    .replace(/\bgof\b/gi, "gofrado")
    .replace(/\bimprimaci[oó]n\b/gi, "imprimacion")
    .replace(/\b(\d)\s*[.,-]?\s*0\s*[.,-]?\s*0\s*[.,-]?\s*(\d)\b/g, "$100$2")
    .replace(/\bral\s+(\d)\s+(\d)\s+(\d)\s+(\d)\b/gi, "RAL $1$2$3$4")
    .replace(/\b(\d{2,4})\s*(?:por|x|\*)\s*(\d{2,4})\b/gi, "$1x$2")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\bm[aá]s\b/gi, " + ");

  return collapseWhitespace(normalized);
};
