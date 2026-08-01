export const normalizeCommercialText = (value: string): string =>
  value.trim().toLocaleUpperCase("es-ES");

export const normalizeOptionalCommercialText = (
  value: string | null | undefined
): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized.toLocaleUpperCase("es-ES") : null;
};
