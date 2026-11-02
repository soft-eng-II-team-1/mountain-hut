import type {ReactNode} from "react";

type InfoNoteProps = {
  children: ReactNode;
  variant?: "info" | "error";
};

export default function InfoNote({children, variant = "info"}: InfoNoteProps) {
  const styles =
    variant === "error"
      ? "border-red-400 bg-red-50 text-red-700"
      : "border-[#3a93a6] bg-[#e3f0f3] text-[#23404d]";

  return (
    <div
      className={`mx-auto w-fit max-w-full rounded-lg border px-8 py-3 text-md ${styles}`}
      role={variant === "error" ? "alert" : "note"}
    >
      {variant === "info" && <span className="mr-2">ℹ️</span>}
      {children}
    </div>
  );
}
