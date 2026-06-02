import type { Customer, DeliveryNoteItemDraft } from "@/domain/entities";

export interface PricePreviewState {
  totalPrice: number;
  unitPrice: number;
}

export const estimateDeliveryNoteItemPrice = (
  item: DeliveryNoteItemDraft,
  customer: Customer
): PricePreviewState => {
  const quantity = item.quantity;
  const specialPiece = customer.specialPieces.find(
    (entry) => entry.name.toLowerCase() === item.description.toLowerCase()
  );

  let totalPrice = 0;

  if (specialPiece) {
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
