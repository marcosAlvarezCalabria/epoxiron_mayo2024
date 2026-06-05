import type { DeliveryNoteTexture } from "@/domain/entities";

export const DELIVERY_NOTE_TEXTURE_OPTIONS: { label: string; value: DeliveryNoteTexture }[] = [
  { label: "Normal", value: "NORMAL" },
  { label: "Mate", value: "MATE" },
  { label: "Texturado", value: "TEXTURADO" },
  { label: "Gofrado", value: "GOFRADO" }
];

export const formatDeliveryNoteTexture = (texture?: DeliveryNoteTexture) =>
  DELIVERY_NOTE_TEXTURE_OPTIONS.find((option) => option.value === (texture ?? "NORMAL"))?.label ?? "Normal";
