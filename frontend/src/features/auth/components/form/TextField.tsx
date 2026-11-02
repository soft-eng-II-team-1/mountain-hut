import type {InputHTMLAttributes} from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
};

export default function TextField({
  label,
  name,
  error,
  className = "",
  ...inputProps
}: TextFieldProps) {
  return (
    <label htmlFor={name} className="flex flex-col text-md text-[#23404d]">
      {label}
      <input
        id={name}
        name={name}
        className={`rounded-md border bg-[#f3f3f3] px-4 py-2 text-lg outline-none focus:ring-2 focus:ring-[#24414f]/40 ${
          error ? "border-red-600" : "border-black"
        } ${className}`}
        {...inputProps}
      />
      {error && <span className="mt-1 text-sm text-red-600">{error}</span>}
    </label>
  );
}
