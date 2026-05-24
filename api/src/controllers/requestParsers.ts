import type { DeliveryNoteStatus } from "../domain/entities/DeliveryNote.js";

export const getRouteParam = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Parámetro de ruta inválido");
  }

  return value;
};

export const getStatusQuery = (value: unknown): DeliveryNoteStatus | undefined => {
  if (value === "DRAFT" || value === "PENDING" || value === "REVIEWED") {
    return value;
  }

  return undefined;
};

