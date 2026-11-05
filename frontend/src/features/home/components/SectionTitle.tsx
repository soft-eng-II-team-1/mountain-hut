import type {ReactNode} from "react";

export default function SectionTitle({children}: {children: ReactNode}) {
  return (
    <h2 className="text-2xl font-medium uppercase tracking-wide text-[#23404d]">
      {children}
    </h2>
  );
}
