import {useEffect, useState} from "react";
import {searchHikers} from "../../../../api/hikers";
import type {HikerQuery, HikerSummary} from "../../../../types";
import {darkButton, inputClass, primaryButton} from "./ui";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const PHONE_CHARS = /^\+?[0-9 ]+$/;
const NAME_CHARS = /^[\p{L}\s'.-]+$/u;

// One box for name, phone or email: what the employee typed decides the criterion.
// Returns a hint instead when the text cannot be searched yet
const toQuery = (text: string): HikerQuery | {hint: string} | null => {
  const value = text.trim();
  if (!value) return null;
  if (value.includes("@"))
    return EMAIL_PATTERN.test(value)
      ? {email: value}
      : {hint: "Type the full email address to search by email."};
  if (PHONE_CHARS.test(value))
    return value.replace(/\D/g, "").length >= 3
      ? {phone: value}
      : {hint: "Type at least 3 digits of the phone number."};
  if (value.length < 2) return {hint: "Type at least 2 letters of the name."};
  if (!NAME_CHARS.test(value))
    return {hint: "Names can contain only letters, spaces, apostrophes, dots and hyphens."};
  return {name: value};
};

type Results = {text: string; hikers: HikerSummary[]; error?: string};

type HikerSearchProps = {
  onSelect: (hiker: HikerSummary) => void;
  onCreateComplete: () => void;
  onCreateTemporary: () => void;
};

// MH-07: the employee looks for the hiker before booking on their behalf
export default function HikerSearch({
  onSelect,
  onCreateComplete,
  onCreateTemporary,
}: HikerSearchProps) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Results | null>(null);

  const query = toQuery(text);
  const searchable = query && !("hint" in query) ? query : null;
  const searchKey = searchable ? JSON.stringify(searchable) : "";

  // waits for a pause in typing before asking the backend
  useEffect(() => {
    if (!searchKey) return;
    const criteria = JSON.parse(searchKey) as HikerQuery;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchHikers(criteria)
        .then((hikers) => !cancelled && setResults({text: searchKey, hikers}))
        .catch(
          (err: Error) =>
            !cancelled &&
            setResults({text: searchKey, hikers: [], error: err.message}),
        );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchKey]);

  const shown = searchKey && results?.text === searchKey ? results : null;
  const searching = !!searchKey && !shown;

  return (
    <div className="flex flex-col gap-6">
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search by name, phone number or email..."
        aria-label="Search hikers by name, phone number or email"
        autoFocus
        className={inputClass}
      />

      {query && "hint" in query && (
        <p className="-mt-4 text-xs text-gray-600">{query.hint}</p>
      )}

      {searching && <p className="text-sm text-gray-600">Searching…</p>}

      {shown?.error && (
        <p role="alert" className="text-sm text-red-600">
          {shown.error}
        </p>
      )}

      {shown && !shown.error && (
        <div>
          <h2 className="text-lg font-semibold">Results</h2>
          {shown.hikers.length === 0 ? (
            <p className="text-sm">
              No hiker found. Check the spelling or create a new profile.
            </p>
          ) : (
            <>
              <p className="text-sm">
                Select the hiker you would like to reserve for.
              </p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3">
                        <span className="sr-only">Select</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.hikers.map((h) => (
                      <tr key={h.user_id} className="border-t border-gray-200">
                        <td className="px-4 py-3">
                          {h.name} {h.surname}
                        </td>
                        <td className="px-4 py-3">{h.email}</td>
                        <td className="px-4 py-3">{h.phone ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onSelect(h)}
                            aria-label={`Select ${h.name} ${h.surname}`}
                            className={primaryButton}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        <button type="button" onClick={onCreateComplete} className={primaryButton}>
          Create new complete hiker profile
        </button>
        <button type="button" onClick={onCreateTemporary} className={darkButton}>
          Create new temporary hiker profile
        </button>
      </div>
    </div>
  );
}
