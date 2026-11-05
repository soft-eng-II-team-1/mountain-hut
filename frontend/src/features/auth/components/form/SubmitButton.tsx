import type {ReactNode} from "react";

type SubmitButtonProps = {
  children: ReactNode;
  loading?: boolean;
};

export default function SubmitButton({
  children,
  loading = false,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-3 py-3 w-full rounded-xl cursor-pointer disabled:bg-[#ccc] disabled:text-[#999] bg-[#24414f] text-xl font-semibold text-white transition hover:bg-[#1c3440] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}
