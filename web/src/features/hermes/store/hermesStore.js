import { create } from "zustand";
export const useHermesStore = create((set) => ({
    isOpen: false,
    activeTab: "chat",
    toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
    setTab: (tab) => set({ activeTab: tab })
}));
