import {useState, type AnimationEvent, type ReactNode} from "react";
import {useToastStore, type ToastItem, type ToastType} from "../../store";

const variants: Record<
  ToastType,
  {color: string; title: string; icon: ReactNode}
> = {
  success: {
    color: "#2f7d5b",
    title: "Success",
    icon: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  },
  error: {
    color: "#c0392b",
    title: "Error",
    icon: <path d="M7 7l10 10M17 7L7 17" />,
  },
  warning: {
    color: "#d08a1c",
    title: "Warning",
    icon: <path d="M12 6v8M12 18h.01" />,
  },
  info: {
    color: "#3a93a6",
    title: "Info",
    icon: <path d="M12 11v7M12 6.5h.01" />,
  },
};

export default function Toast({toast}: {toast: ToastItem}) {
  const remove = useToastStore((s) => s.remove);
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const {color, title, icon} = variants[toast.type];

  // Progress bar and slide-out both report through animationend; only react to our own
  const handleCardAnimationEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && leaving) remove(toast.id);
  };

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onAnimationEnd={handleCardAnimationEnd}
      className={`pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl bg-white py-4 pr-10 pl-4 text-[#23404d] shadow-[4px_6px_14px_rgba(0,0,0,0.18)] ${
        leaving ? "animate-toast-out" : "animate-toast-in"
      }`}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
        style={{backgroundColor: color}}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-semibold">{toast.title ?? title}</p>
        <p className="mt-0.5 text-sm wrap-break-word text-[#23404d]/80">
          {toast.message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setLeaving(true)}
        aria-label="Close notification"
        className="absolute top-2 right-2 cursor-pointer rounded-md p-1 text-[#23404d]/50 transition hover:bg-[#23404d]/5 hover:text-[#23404d]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      </button>

      {/* shrinking bar doubles as the timer: when it finishes the toast closes */}
      {!leaving && (
        <div
          className="animate-toast-progress absolute bottom-0 left-0 h-1 w-full origin-left"
          style={{
            backgroundColor: color,
            animationDuration: `${toast.duration}ms`,
            animationPlayState: paused ? "paused" : "running",
          }}
          onAnimationEnd={(e) => {
            e.stopPropagation();
            setLeaving(true);
          }}
        />
      )}
    </div>
  );
}
