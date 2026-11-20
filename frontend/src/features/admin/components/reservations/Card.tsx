import type {ReactNode} from "react";

// White card with a title row (title on the left, actions on the right) and a divider
export default function Card({
  title,
  actions,
  children,
  footer,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  // full-width strip under the card body (e.g. an error banner)
  footer?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 md:px-8">
        <h2 className="text-xl font-semibold">{title}</h2>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="px-6 py-6 md:px-8">{children}</div>
      {footer}
    </section>
  );
}
