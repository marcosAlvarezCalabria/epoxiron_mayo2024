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

export const getPositiveIntegerQuery = (value: unknown): number | undefined => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
};

export const getNonNegativeIntegerQuery = (value: unknown): number | undefined => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
};

export const getDateQuery = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
};
