import { create } from "zustand";

interface HermesUiState {
  isOpen: boolean;
  activeTab: "chat" | "tasks";
  toggleOpen: () => void;
  setTab: (tab: "chat" | "tasks") => void;
}

export const useHermesStore = create<HermesUiState>((set) => ({
  isOpen: false,
  activeTab: "chat",
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setTab: (tab) => set({ activeTab: tab })
}));

