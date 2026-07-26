export type Money = string;

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

const parseScaled = (value: string, scale: number): bigint => {
  const normalized = value.trim();
  if (!DECIMAL_PATTERN.test(normalized)) {
    throw new Error("INVALID_DECIMAL");
  }

  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ""] = unsigned.split(".");
  const padded = `${fraction}${"0".repeat(scale + 1)}`;
  const retained = padded.slice(0, scale);
  const roundDigit = Number(padded[scale] ?? "0");
  let scaled = BigInt(whole) * 10n ** BigInt(scale) + BigInt(retained || "0");
  if (roundDigit >= 5) scaled += 1n;
  return negative ? -scaled : scaled;
};

const formatScaled = (value: bigint, scale: number): string => {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const divisor = 10n ** BigInt(scale);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(scale, "0");
  return `${negative ? "-" : ""}${whole.toString()}${scale ? `.${fraction}` : ""}`;
};

export const canonicalDecimal = (value: string, scale: number): string =>
  formatScaled(parseScaled(value, scale), scale);

export const moneyFromNumber = (value: number): Money => {
  if (!Number.isFinite(value)) throw new Error("INVALID_MONEY");
  return canonicalDecimal(value.toFixed(2), 2);
};

export const unitPriceFromSubtotal = (subtotal: Money, quantity: number): string => {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("INVALID_QUANTITY");
  const subtotalCents = parseScaled(subtotal, 2);
  const scaledNumerator = subtotalCents * 100n;
  const divisor = BigInt(quantity);
  const rounded = (scaledNumerator + divisor / 2n) / divisor;
  return formatScaled(rounded, 4);
};

export const calculateInvoiceAmounts = (
  lineSubtotals: Money[],
  taxRate: string
): { subtotal: Money; taxAmount: Money; total: Money } => {
  const subtotalCents = lineSubtotals.reduce((sum, value) => sum + parseScaled(value, 2), 0n);
  const rateBasisPoints = parseScaled(taxRate, 2);
  const numerator = subtotalCents * rateBasisPoints;
  const taxCents = (numerator + 5_000n) / 10_000n;

  return {
    subtotal: formatScaled(subtotalCents, 2),
    taxAmount: formatScaled(taxCents, 2),
    total: formatScaled(subtotalCents + taxCents, 2)
  };
};
