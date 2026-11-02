import type {FormEvent, ReactNode} from "react";

type FormCardProps = {
  title: string;
  subtitle?: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  footer?: ReactNode;
};

// Page title + white rounded card wrapping a form
export default function FormCard({
  title,
  subtitle,
  onSubmit,
  children,
  footer,
}: FormCardProps) {
  return (
    <div className="mx-auto w-full max-w-212">
      <div className="mb-5 text-center text-[#23404d]">
        <h1 className="text-4xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-xl">{subtitle}</p>}
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="rounded-3xl bg-white p-6 shadow-[6px_8px_10px_rgba(0,0,0,0.18)] sm:px-20"
      >
        <div className="flex flex-col gap-4">{children}</div>
        {footer && (
          <div className="mt-4 text-center text-md text-[#23404d]">
            {footer}
          </div>
        )}
      </form>
    </div>
  );
}
