import type { DeliveryNoteItemFormState } from "@/components/delivery-notes/ItemFormSheet";

const DRAFT_KEY_PREFIX = "epoxiron:delivery-note-composer:v1";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface DeliveryNoteDraftForm {
  customerId: string;
  date: string;
  items: DeliveryNoteItemFormState[];
  notes: string;
}

export interface StoredDeliveryNoteDraft {
  version: 1;
  savedAt: number;
  form: DeliveryNoteDraftForm;
  customerSearch: string;
}

const getStorage = (storage?: Storage): Storage | null => {
  if (storage) return storage;
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const removeDraft = (storage: Storage, key: string) => {
  try {
    storage.removeItem(key);
  } catch {
    // Storage may be blocked by browser privacy settings.
  }
};

const getDraftKey = (email: string) =>
  `${DRAFT_KEY_PREFIX}:${encodeURIComponent(email.trim().toLowerCase())}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDraftItem = (value: unknown): value is DeliveryNoteItemFormState => {
  if (!isRecord(value)) return false;
  return (
    typeof value.clientId === "string" &&
    typeof value.hasThickness === "boolean" &&
    typeof value.hasPrimer === "boolean" &&
    typeof value.saveAsSpecialPiece === "boolean" &&
    typeof value.customUnitPrice === "string" &&
    typeof value.description === "string" &&
    typeof value.color === "string" &&
    (value.pricingMode === "DIMENSIONS" || value.pricingMode === "UNIT") &&
    ["NORMAL", "MATE", "TEXTURADO", "GOFRADO"].includes(String(value.texture)) &&
    typeof value.linearMeters === "string" &&
    typeof value.quantity === "string" &&
    typeof value.squareMeters === "string"
  );
};

const isStoredDraft = (value: unknown): value is StoredDeliveryNoteDraft => {
  if (!isRecord(value) || value.version !== 1 || typeof value.savedAt !== "number") return false;
  if (!isRecord(value.form) || !Array.isArray(value.form.items)) return false;
  return (
    typeof value.form.customerId === "string" &&
    typeof value.form.date === "string" &&
    value.form.items.every(isDraftItem) &&
    typeof value.form.notes === "string" &&
    typeof value.customerSearch === "string"
  );
};

export const hasDeliveryNoteDraftContent = (
  form: DeliveryNoteDraftForm,
  customerSearch: string
) =>
  Boolean(
    form.customerId || form.items.length > 0 || form.notes.trim() || customerSearch.trim()
  );

export const readDeliveryNoteDraft = (
  email: string,
  storage?: Storage,
  now = Date.now()
): StoredDeliveryNoteDraft | null => {
  const target = getStorage(storage);
  if (!target) return null;
  const key = getDraftKey(email);

  try {
    const raw = target.getItem(key);
    if (!raw) return null;
    const draft: unknown = JSON.parse(raw);
    if (!isStoredDraft(draft) || now - draft.savedAt > DRAFT_MAX_AGE_MS) {
      removeDraft(target, key);
      return null;
    }
    return draft;
  } catch {
    removeDraft(target, key);
    return null;
  }
};

export const saveDeliveryNoteDraft = (
  email: string,
  draft: Omit<StoredDeliveryNoteDraft, "version">,
  storage?: Storage
): boolean => {
  const target = getStorage(storage);
  if (!target) return false;
  try {
    target.setItem(getDraftKey(email), JSON.stringify({ version: 1, ...draft }));
    return true;
  } catch {
    return false;
  }
};

export const clearDeliveryNoteDraft = (email: string, storage?: Storage) => {
  const target = getStorage(storage);
  if (!target) return;
  removeDraft(target, getDraftKey(email));
};
