import type {Slot} from "../types";

// the start and end of any slot (staff or bookable)
type SlotTimes = Pick<Slot, "date_time_start" | "date_time_end">;

// "YYYY-MM-DD" of a date in local time, the format of <input type="date">
export const toInputDate = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// [start, end) of a local day
export const dayRange = (inputDate: string) => {
  const [y, m, d] = inputDate.split("-").map(Number);
  return {from: new Date(y, m - 1, d), to: new Date(y, m - 1, d + 1)};
};

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

// output: "31 Oct 2026"
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export type Meal = "Breakfast" | "Lunch" | "Dinner";

// The meal a slot belongs to, from its start hour
export const mealOf = (slot: SlotTimes): Meal => {
  const hour = new Date(slot.date_time_start).getHours();
  return hour < 11 ? "Breakfast" : hour < 17 ? "Lunch" : "Dinner";
};

// "Dinner (19:30 - 21:30)"
export const slotLabel = (slot: SlotTimes) =>
  `${mealOf(slot)} (${formatTime(slot.date_time_start)} - ${formatTime(slot.date_time_end)})`;
