import type {InputHTMLAttributes} from "react";
import {inputClass} from "./ui";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
};

export default function Field({label, name, error, ...inputProps}: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <label htmlFor={name} className="flex flex-col gap-1 text-sm">
      {label}
      <input
        id={name}
        name={name}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`${inputClass} ${error ? "border-red-600" : ""}`}
        {...inputProps}
      />
      {error && (
        <span id={errorId} className="text-xs text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
