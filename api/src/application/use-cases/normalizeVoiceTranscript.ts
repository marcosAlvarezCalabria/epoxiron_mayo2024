const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

export const normalizeVoiceTranscript = (transcript: string): string => {
  let normalized = transcript;

  normalized = normalized
    .replace(/\bgof\b/gi, "gofrado")
    .replace(/\bgofrado\b/gi, "gofrado")
    .replace(/\bimprimaci[oó]n\b/gi, "imprimacion")
    .replace(/\btexturizado\b/gi, "texturado")
    .replace(/\bmetro lineal(?:es)?\b/gi, "metros lineales")
    .replace(/\bund\b/gi, "unidades")
    .replace(/\bunid\b/gi, "unidades")
    .replace(/\bcaj[oó]n\b/gi, "cajon")
    .replace(/\bg[oó]ndola\b/gi, "gondola")
    .replace(/\bcanal[oó]n\b/gi, "canalon")
    .replace(/\bkado\b/gi, "cado")
    .replace(/\b(\d)\s*[.,-]?\s*0\s*[.,-]?\s*0\s*[.,-]?\s*(\d)\b/g, "$100$2")
    .replace(/\bral\s+(\d)\s+(\d)\s+(\d)\s+(\d)\b/gi, "RAL $1$2$3$4")
    .replace(/\b(\d{2,4})\s*(?:por|x|\*)\s*(\d{2,4})\b/gi, "$1x$2")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\bm[aá]s\b/gi, " + ");

  return collapseWhitespace(normalized);
};
