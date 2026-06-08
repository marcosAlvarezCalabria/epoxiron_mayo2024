const MILLIMETERS_PER_METER = 1000;
const SQUARE_MILLIMETERS_PER_SQUARE_METER = 1000000;

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

export const parseMillimetersToMeters = (value: string) => {
  const parsed = parseDecimal(value);
  if (parsed == null) {
    return null;
  }

  return parsed / MILLIMETERS_PER_METER;
};

export const parseSquareMillimetersToSquareMeters = (value: string) => {
  const parsed = parseDecimal(value);
  if (parsed == null) {
    return null;
  }

  return parsed / SQUARE_MILLIMETERS_PER_SQUARE_METER;
};

export const formatMetersAsMillimeters = (value: number | null | undefined) => {
  if (value == null) {
    return "";
  }

  return formatNumber(value * MILLIMETERS_PER_METER);
};

export const formatSquareMetersAsSquareMillimeters = (value: number | null | undefined) => {
  if (value == null) {
    return "";
  }

  return formatNumber(value * SQUARE_MILLIMETERS_PER_SQUARE_METER);
};

export const formatMetersSummaryAsMillimeters = (value: number | null | undefined) =>
  formatNumber((value ?? 0) * MILLIMETERS_PER_METER);

export const formatSquareMetersSummaryAsSquareMillimeters = (
  value: number | null | undefined
) => formatNumber((value ?? 0) * SQUARE_MILLIMETERS_PER_SQUARE_METER);
