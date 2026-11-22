import type {HikerSummary} from "../../../../types";

// Who the employee is booking for: a registered hiker or a temporary contact
// (a temporary hiker has no account, the backend only stores name and phone)
export type BookingHiker =
  | ({kind: "registered"} & HikerSummary)
  | {kind: "temporary"; name: string; surname: string; phone: string | null};

export const fullName = (h: {name: string; surname: string}) =>
  `${h.name} ${h.surname}`;

export const primaryButton =
  "cursor-pointer rounded-lg bg-[#cc6000] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b35400] disabled:cursor-not-allowed disabled:opacity-50";

export const darkButton =
  "cursor-pointer rounded-lg bg-[#24414f] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1c3440] disabled:cursor-not-allowed disabled:opacity-50";

export const outlineButton =
  "cursor-pointer rounded-lg border border-[#24414f] bg-white px-4 py-1.5 text-sm font-medium text-[#24414f] transition hover:bg-[#24414f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

export const inputClass =
  "w-full rounded-md border border-gray-400 bg-white px-3 py-2 text-sm text-[#23404d] outline-none focus:border-[#24414f] disabled:cursor-not-allowed disabled:text-gray-400";

// Same phone rule as the backend (userRules.js and the temporary contact)
export const PHONE_PATTERN = /^\+?[0-9 ]{6,20}$/;
