import {useToastStore, type ToastType} from "../../store";

type ToastOptions = {
  title?: string;
  duration?: number;
};

const DEFAULT_DURATION = 4000;

const show = (type: ToastType) => (message: string, options: ToastOptions = {}) =>
  useToastStore.getState().add({
    type,
    message,
    title: options.title,
    duration: options.duration ?? DEFAULT_DURATION,
  });

// Call from anywhere, e.g. toast.success("Logged in")
export const toast = {
  success: show("success"),
  error: show("error"),
  info: show("info"),
  warning: show("warning"),
  dismiss: (id: number) => useToastStore.getState().remove(id),
};
