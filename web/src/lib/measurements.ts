const parseDecimal = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  return normalized ? Number.parseFloat(normalized) : null;
};

const formatNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
};

export const parseMeters = (value: string) => parseDecimal(value);

export const parseMetersSquared = (value: string) => parseDecimal(value);

export const formatMeters = (value: number | null | undefined) => {
  if (value == null) {
    return "";
  }

  return formatNumber(value);
};

export const formatSquareMeters = (value: number | null | undefined) => {
  if (value == null) {
    return "";
  }

  return formatNumber(value);
};

export const formatMetersSummary = (value: number | null | undefined) =>
  formatNumber(value ?? 0);

export const formatSquareMetersSummary = (value: number | null | undefined) =>
  formatNumber(value ?? 0);
