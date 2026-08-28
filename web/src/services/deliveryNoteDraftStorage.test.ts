import { describe, expect, it } from "vitest";
import {
  clearDeliveryNoteDraft,
  hasDeliveryNoteDraftContent,
  readDeliveryNoteDraft,
  saveDeliveryNoteDraft,
  type DeliveryNoteDraftForm
} from "./deliveryNoteDraftStorage";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const form: DeliveryNoteDraftForm = {
  customerId: "dce47b8f-e3f0-47d7-87c7-46c4eed36441",
  date: "2026-08-28",
  items: [],
  notes: "Entregar por la tarde"
};

describe("delivery note draft storage", () => {
  it("stores drafts separately for each authenticated user", () => {
    const storage = new MemoryStorage();
    const savedAt = Date.UTC(2026, 7, 28, 12);

    expect(
      saveDeliveryNoteDraft("uno@example.com", { savedAt, form, customerSearch: "" }, storage)
    ).toBe(true);
    expect(readDeliveryNoteDraft("uno@example.com", storage, savedAt)?.form).toEqual(form);
    expect(readDeliveryNoteDraft("otro@example.com", storage, savedAt)).toBeNull();
  });

  it("removes expired drafts", () => {
    const storage = new MemoryStorage();
    const savedAt = Date.UTC(2026, 7, 1);

    saveDeliveryNoteDraft("uno@example.com", { savedAt, form, customerSearch: "" }, storage);

    expect(
      readDeliveryNoteDraft("uno@example.com", storage, savedAt + 8 * 24 * 60 * 60 * 1000)
    ).toBeNull();
    expect(storage.length).toBe(0);
  });

  it("clears a saved draft explicitly", () => {
    const storage = new MemoryStorage();

    saveDeliveryNoteDraft(
      "uno@example.com",
      { savedAt: Date.now(), form, customerSearch: "" },
      storage
    );
    clearDeliveryNoteDraft("uno@example.com", storage);

    expect(readDeliveryNoteDraft("uno@example.com", storage)).toBeNull();
  });

  it("ignores an untouched empty form", () => {
    expect(
      hasDeliveryNoteDraftContent(
        { customerId: "", date: "2026-08-28", items: [], notes: "" },
        ""
      )
    ).toBe(false);
  });
});
