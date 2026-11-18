import type {ReactNode} from "react";
import {Link} from "react-router";

// Small building blocks shared by the My Bookings pages

export function PageTitle({title, children}: {title: string; children?: ReactNode}) {
  return (
    <div className="mb-6">
      <h2 className="text-3xl font-semibold">{title}</h2>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}

export function Panel({children}: {children: ReactNode}) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-[4px_6px_10px_rgba(0,0,0,0.15)] sm:px-8">
      {children}
    </section>
  );
}

// Grey inner box with a heading, as for "General Details" and "Dietary Restrictions"
export function InfoBox({title, children}: {title: string; children: ReactNode}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="rounded-md border border-gray-300 bg-[#f1f3f5] p-4">
        {children}
      </div>
    </div>
  );
}

export function BookMoreLink() {
  return (
    <p className="text-center text-sm">
      Planning your next adventure?{" "}
      <Link to="/book" className="underline">
        Reserve a bed or book a table.
      </Link>
    </p>
  );
}

export const primaryButton =
  "inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#24414f] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1c3440] disabled:cursor-not-allowed disabled:opacity-50";

export const outlineButton =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#24414f] bg-white px-5 py-2 text-sm font-semibold text-[#24414f] transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButton =
  "inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#8b0d0d] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#6f0a0a] disabled:cursor-not-allowed disabled:opacity-50";
