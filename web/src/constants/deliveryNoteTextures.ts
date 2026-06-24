import type { DeliveryNoteTexture } from "@/domain/entities";

export const DELIVERY_NOTE_TEXTURE_OPTIONS: { label: string; value: DeliveryNoteTexture }[] = [
  { label: "NORMAL", value: "NORMAL" },
  { label: "MATE", value: "MATE" },
  { label: "TEXTURADO", value: "TEXTURADO" },
  { label: "GOFRADO", value: "GOFRADO" }
];

export const formatDeliveryNoteTexture = (texture?: DeliveryNoteTexture) =>
  DELIVERY_NOTE_TEXTURE_OPTIONS.find((option) => option.value === (texture ?? "NORMAL"))?.label ?? "NORMAL";
