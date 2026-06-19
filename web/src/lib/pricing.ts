import type { Customer, DeliveryNoteItemDraft } from "@/domain/entities";
import { normalizeSpecialPieceName } from "@/lib/deliveryNoteItemDescription";

export interface PricePreviewState {
  totalPrice: number;
  unitPrice: number;
}

export const resolvePricePreview = (
  primary: PricePreviewState | null | undefined,
  fallback: PricePreviewState | null | undefined
): PricePreviewState | null => {
  const hasUsablePrimary =
    primary != null &&
    Number.isFinite(primary.totalPrice) &&
    Number.isFinite(primary.unitPrice) &&
    (primary.totalPrice > 0 || fallback == null || fallback.totalPrice <= 0);

  if (hasUsablePrimary) {
    return primary;
  }

  return fallback ?? null;
};

export const estimateDeliveryNoteItemPrice = (
  item: DeliveryNoteItemDraft,
  customer: Customer
): PricePreviewState => {
  const quantity = item.quantity;
  const pricingMode = item.pricingMode ?? "DIMENSIONS";
  const specialPiece = customer.specialPieces.find(
    (entry) => normalizeSpecialPieceName(entry.name) === normalizeSpecialPieceName(item.description)
  );

  let totalPrice = 0;

  if (pricingMode === "UNIT" && item.customUnitPrice != null) {
    totalPrice = item.customUnitPrice * quantity;
  } else if (specialPiece) {
    totalPrice = specialPiece.price * quantity;
  } else {
    const pricePerPiece =
      (item.linearMeters ?? 0) * customer.pricePerLinearMeter +
      (item.squareMeters ?? 0) * customer.pricePerSquareMeter;

    totalPrice = pricePerPiece * quantity;
  }

  const minimum = customer.minimumRate * quantity;
  if (totalPrice < minimum) {
    totalPrice = minimum;
  }

  if (item.thickness) {
    totalPrice *= 2;
  }

  if (item.primer) {
    totalPrice *= 2;
  }

  totalPrice = Math.round(totalPrice * 100) / 100;

  return {
    totalPrice,
    unitPrice: Math.round((totalPrice / quantity) * 100) / 100
  };
};
