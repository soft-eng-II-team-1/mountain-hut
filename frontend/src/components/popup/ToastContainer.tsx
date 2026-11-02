import {useToastStore} from "../../store";
import Toast from "./Toast";

// Mount once (in MainLayout); shows every toast added with toast.success/error/...
export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 left-4 z-50 flex flex-col items-end gap-3 sm:left-auto sm:w-96"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  );
}
