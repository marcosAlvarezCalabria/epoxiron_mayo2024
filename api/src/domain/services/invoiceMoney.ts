import { Decimal } from "decimal.js";

export type Money = string;

Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP });

export const canonicalDecimal = (value: string, scale: number): string =>
  new Decimal(value.trim()).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP).toFixed(scale);

export const moneyFromNumber = (value: number): Money => {
  if (!Number.isFinite(value)) throw new Error("INVALID_MONEY");
  return new Decimal(value.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
};

export const unitPriceFromSubtotal = (subtotal: Money, quantity: number): string => {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("INVALID_QUANTITY");
  return new Decimal(subtotal)
    .dividedBy(quantity)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    .toFixed(4);
};

export const calculateInvoiceAmounts = (
  lineSubtotals: Money[],
  taxRate: string
): { subtotal: Money; taxAmount: Money; total: Money } => {
  const subtotal = lineSubtotals.reduce(
    (sum, value) => sum.plus(new Decimal(value)),
    new Decimal(0)
  );
  const taxAmount = subtotal
    .times(new Decimal(taxRate).dividedBy(100))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const total = subtotal.plus(taxAmount);

  return {
    subtotal: subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
  };
};
