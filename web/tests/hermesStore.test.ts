import { describe, expect, it } from "vitest";
import { useHermesStore } from "../src/features/hermes/store/hermesStore";

describe("useHermesStore", () => {
  it("toggles panel state", () => {
    useHermesStore.setState({ isOpen: false, activeTab: "chat" });
    useHermesStore.getState().toggleOpen();
    expect(useHermesStore.getState().isOpen).toBe(true);
  });

  it("changes active tab", () => {
    useHermesStore.getState().setTab("tasks");
    expect(useHermesStore.getState().activeTab).toBe("tasks");
  });
});
