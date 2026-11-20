import type {FormEvent, ReactNode} from "react";

type FormCardProps = {
  title: string;
  subtitle?: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  footer?: ReactNode;
  // decorative picture; with it the card is narrower and holds the title too
  icon?: string;
};

const cardClass =
  "rounded-3xl bg-white p-6 shadow-[6px_8px_10px_rgba(0,0,0,0.18)]";

// Page title + white rounded card wrapping a form
export default function FormCard({
  title,
  subtitle,
  onSubmit,
  children,
  footer,
  icon,
}: FormCardProps) {
  const footerBlock = footer && (
    <div className="mt-4 text-center text-md text-[#23404d]">{footer}</div>
  );

  if (icon) {
    return (
      <div className="mx-auto w-full max-w-md">
        <form
          onSubmit={onSubmit}
          noValidate
          className={`${cardClass} sm:px-8 sm:pt-8`}
        >
          <div className="mb-6 text-center text-[#23404d]">
            <img src={icon} alt="" className="mx-auto mb-5 h-14 w-auto" />
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm">{subtitle}</p>}
          </div>
          <div className="flex flex-col gap-4">{children}</div>
          {footerBlock}
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-212">
      <div className="mb-5 text-center text-[#23404d]">
        <h1 className="text-4xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-xl">{subtitle}</p>}
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className={`${cardClass} sm:px-20`}
      >
        <div className="flex flex-col gap-4">{children}</div>
        {footerBlock}
      </form>
    </div>
  );
}
