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

export const squareMetersFromMillimeters = (
  widthMm: number | null,
  heightMm: number | null
) => {
  if (widthMm == null || heightMm == null || widthMm <= 0 || heightMm <= 0) {
    return null;
  }

  return (widthMm * heightMm) / 1_000_000;
};

export const parseSquareMetersFromMillimeters = (widthMm: string, heightMm: string) =>
  squareMetersFromMillimeters(parseDecimal(widthMm), parseDecimal(heightMm));

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

export const formatMillimeters = (value: number | null | undefined) => {
  if (value == null) {
    return "";
  }

  return formatNumber(value);
};

export const formatMillimeterDimensions = (
  widthMm: number | null | undefined,
  heightMm: number | null | undefined
) =>
  widthMm != null && heightMm != null
    ? `${formatNumber(widthMm)} x ${formatNumber(heightMm)} mm`
    : null;

export const formatMetersSummary = (value: number | null | undefined) =>
  formatNumber(value ?? 0);

export const formatSquareMetersSummary = (value: number | null | undefined) =>
  formatNumber(value ?? 0);
