import {useEffect, useState, type FormEvent} from "react";
import {useNavigate} from "react-router";
import {getBookableSlots, getSlotAvailability} from "../../../api/reservations";
import {ApiError} from "../../../api/client";
import {useAuthStore} from "../../../store";
import {
  dayRange,
  formatTime,
  mealOf,
  toInputDate,
  type Meal,
} from "../../../lib/slotTime";
import {STAFF_ROLES, type BookableSlot} from "../../../types";
import type {BookTableState} from "../../booking/pages/BookTablePage";

const MIN_GUESTS = 1;
const MAX_GUESTS = 30;

type LoadedSlots = {date: string; slots: BookableSlot[]; error?: string};

type Result =
  | {key: string; available: true; seats: number}
  | {key: string; available: false; message: string};

const fieldClass =
  "h-11 w-full rounded-md border border-gray-400 bg-white px-3 text-sm text-[#23404d] outline-none focus:border-[#24414f] disabled:cursor-not-allowed disabled:text-gray-400";

const labelClass = "flex flex-col gap-1 text-sm text-[#23404d]";

const stepClass =
  "flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-400 bg-white text-lg text-[#23404d] transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50";

// MH-04: anyone can check if a time slot has room for their party, before logging in
export default function AvailabilityBar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [date, setDate] = useState(() => toInputDate(new Date()));
  const [guests, setGuests] = useState(2);
  const [loaded, setLoaded] = useState<LoadedSlots | null>(null);
  const [chosenMeal, setChosenMeal] = useState<Meal | "">("");
  const [chosenSlotId, setChosenSlotId] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // every open slot of the day (party of 1), the party size is checked on demand
  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    const {from, to} = dayRange(date);
    getBookableSlots(from, to, 1)
      .then((slots) => !cancelled && setLoaded({date, slots}))
      .catch(
        (err: Error) =>
          !cancelled && setLoaded({date, slots: [], error: err.message}),
      );
    return () => {
      cancelled = true;
    };
  }, [date]);

  const loading = loaded?.date !== date;
  const slots = loading ? [] : loaded.slots;

  const meals = [...new Set(slots.map(mealOf))];
  const meal = meals.includes(chosenMeal as Meal) ? chosenMeal : meals[0];
  const mealSlots = slots.filter((s) => mealOf(s) === meal);
  const slot =
    mealSlots.find((s) => s.slot_id === chosenSlotId) ?? mealSlots[0];

  // a result is only shown for the inputs it was checked with
  const resultKey = `${slot?.slot_id}#${guests}`;
  const shown = result?.key === resultKey ? result : null;

  const handleCheck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slot) return;
    const key = resultKey;
    setChecking(true);
    try {
      const availability = await getSlotAvailability(slot.slot_id, guests);
      setResult(
        availability.available
          ? {key, available: true, seats: availability.totalAvailableSeats}
          : {key, available: false, message: noRoom(guests)},
      );
    } catch (err) {
      // the backend answers 400 when the party does not fit
      setResult({
        key,
        available: false,
        message:
          err instanceof ApiError && err.status === 400
            ? noRoom(guests)
            : (err as Error).message,
      });
    } finally {
      setChecking(false);
    }
  };

  const handleBook = () => {
    if (!slot) return;
    const state: BookTableState = {date, guests, slotId: slot.slot_id};
    navigate("/book", {state});
  };

  // staff cannot book from the website, the booking page is for hikers
  const canBook = !user || !STAFF_ROLES.includes(user.role);

  const emptyMessage = loading
    ? null
    : loaded.error
      ? loaded.error
      : slots.length === 0
        ? "No time slots are open on this day, try another date."
        : null;

  return (
    <form
      onSubmit={handleCheck}
      aria-label="Check availability"
      className="rounded-xl bg-[#f7f8f9] p-5 shadow-[0_8px_20px_rgba(0,0,0,0.25)] md:px-8"
    >
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-[1.2fr_1.2fr_1fr_1.2fr_auto] md:items-end">
        <label className={labelClass}>
          Date
          <input
            type="date"
            value={date}
            min={toInputDate(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </label>

        <div className={labelClass}>
          <span id="home-guests-label">Guests</span>
          <div className="flex gap-2">
            <div
              aria-labelledby="home-guests-label"
              aria-live="polite"
              className={`${fieldClass} flex items-center`}
            >
              {guests}
            </div>
            <button
              type="button"
              aria-label="Add a guest"
              onClick={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))}
              disabled={guests >= MAX_GUESTS}
              className={stepClass}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Remove a guest"
              onClick={() => setGuests((g) => Math.max(MIN_GUESTS, g - 1))}
              disabled={guests <= MIN_GUESTS}
              className={stepClass}
            >
              −
            </button>
          </div>
        </div>

        <label className={labelClass}>
          Meal
          <select
            value={meal ?? ""}
            onChange={(e) => setChosenMeal(e.target.value as Meal)}
            disabled={meals.length === 0}
            className={`${fieldClass} cursor-pointer`}
          >
            {meals.length === 0 ? (
              <option value="">{loading ? "Loading…" : "—"}</option>
            ) : (
              meals.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            )}
          </select>
        </label>

        <label className={labelClass}>
          Time Slot
          <select
            value={slot?.slot_id ?? ""}
            onChange={(e) => setChosenSlotId(e.target.value)}
            disabled={mealSlots.length === 0}
            className={`${fieldClass} cursor-pointer`}
          >
            {mealSlots.length === 0 ? (
              <option value="">{loading ? "Loading…" : "—"}</option>
            ) : (
              mealSlots.map((s) => (
                <option key={s.slot_id} value={s.slot_id}>
                  {formatTime(s.date_time_start)} - {formatTime(s.date_time_end)}
                </option>
              ))
            )}
          </select>
        </label>

        <button
          type="submit"
          disabled={!slot || checking}
          className="h-11 cursor-pointer rounded-lg bg-[#4f6b77] px-6 font-semibold text-white shadow-md transition hover:bg-[#24414f] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 md:col-span-1"
        >
          {checking ? "Checking…" : "Check Availability"}
        </button>
      </div>

      {emptyMessage && (
        <p role="status" className="mt-4 text-sm text-[#cc6000]">
          {emptyMessage}
        </p>
      )}

      {shown && (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          {shown.available ? (
            <>
              <p className="text-green-700">
                Good news: there is room for {guests}{" "}
                {guests === 1 ? "guest" : "guests"} ({shown.seats}{" "}
                {shown.seats === 1 ? "seat" : "seats"} free).
              </p>
              {canBook && (
                <button
                  type="button"
                  onClick={handleBook}
                  className="cursor-pointer rounded-lg bg-[#cc6000] px-5 py-2 font-semibold text-white shadow-md transition hover:bg-[#b35400]"
                >
                  Book now
                </button>
              )}
            </>
          ) : (
            <p className="text-[#cc6000]">{shown.message}</p>
          )}
        </div>
      )}
    </form>
  );
}

const noRoom = (guests: number) =>
  `There is not enough room for ${guests} ${guests === 1 ? "guest" : "guests"} in this time slot. Try another time or fewer guests.`;
