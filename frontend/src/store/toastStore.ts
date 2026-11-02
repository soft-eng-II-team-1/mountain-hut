import {create} from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
  // ms before it closes by itself
  duration: number;
};

type ToastState = {
  toasts: ToastItem[];
  add: (toast: Omit<ToastItem, "id">) => number;
  remove: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  add: (toast) => {
    const id = nextId++;
    set((s) => ({toasts: [...s.toasts, {...toast, id}]}));
    return id;
  },

  remove: (id) => set((s) => ({toasts: s.toasts.filter((t) => t.id !== id)})),
}));
