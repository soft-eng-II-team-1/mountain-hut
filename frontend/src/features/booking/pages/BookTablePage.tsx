import {useEffect, useState} from "react";
import {useLocation, useNavigate} from "react-router";
import {bookTable, getBookableSlots} from "../../../api/reservations";
import {toast} from "../../../components/popup";
import {
  dayRange,
  formatDate,
  formatTime,
  mealOf,
  toInputDate,
  type Meal,
} from "../../../lib/slotTime";
import type {BookableSlot} from "../../../types";
import ConfirmationEmailNote from "../components/ConfirmationEmailNote";
import type {PartyRequirementsState} from "./PartyRequirementsPage";

const MIN_GUESTS = 1;
const MAX_GUESTS = 30;

type LoadedSlots = {
  // date + party size + reload counter they were loaded for
  key: string;
  slots: BookableSlot[];
  error?: string;
};

const fieldClass =
  "w-full rounded-md border border-gray-400 bg-[#f1f1f1] px-3 py-2 text-sm text-[#23404d] outline-none focus:border-[#24414f] disabled:cursor-not-allowed disabled:text-gray-400";

const labelClass = "flex flex-col gap-1 text-sm text-[#23404d]";

const stepClass =
  "flex h-[2.375rem] w-10 cursor-pointer items-center justify-center rounded-md border border-gray-400 bg-[#f1f1f1] text-lg text-[#23404d] transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50";

// sent by the home page availability check, to start from the slot the hiker checked
export type BookTableState = {date: string; guests: number; slotId: string};

export default function BookTablePage() {
  const navigate = useNavigate();
  const prefill = useLocation().state as BookTableState | null;
  const [date, setDate] = useState(
    () => prefill?.date ?? toInputDate(new Date()),
  );
  const [guests, setGuests] = useState(prefill?.guests ?? 2);
  const [loaded, setLoaded] = useState<LoadedSlots | null>(null);
  // bumped to load the same day again (e.g. after a booking)
  const [reload, setReload] = useState(0);
  const loadKey = `${date}#${guests}#${reload}`;
  const [chosenMeal, setChosenMeal] = useState<Meal | "">("");
  const [chosenSlotId, setChosenSlotId] = useState(prefill?.slotId ?? "");
  const [booking, setBooking] = useState(false);

  // slots of the chosen day that still have room for the party.
  // The backend already hides full slots and slots starting in less than 2 hours (MH-01)
  useEffect(() => {
    if (!date) return;
    const key = `${date}#${guests}#${reload}`;
    let cancelled = false;
    const {from, to} = dayRange(date);
    getBookableSlots(from, to, guests)
      .then((slots) => {
        if (!cancelled) setLoaded({key, slots});
      })
      .catch((err: Error) => {
        if (!cancelled) setLoaded({key, slots: [], error: err.message});
      });
    return () => {
      cancelled = true;
    };
  }, [date, guests, reload]);

  const loading = loaded?.key !== loadKey;
  const bookable = loading ? [] : loaded.slots;

  const meals = [...new Set(bookable.map(mealOf))];
  // with no meal picked yet, follow the chosen slot (e.g. the one checked on the home page)
  const chosenSlot = bookable.find((s) => s.slot_id === chosenSlotId);
  const meal = meals.includes(chosenMeal as Meal)
    ? chosenMeal
    : chosenSlot
      ? mealOf(chosenSlot)
      : meals[0];
  const mealSlots = bookable.filter((s) => mealOf(s) === meal);
  const slot =
    mealSlots.find((s) => s.slot_id === chosenSlotId) ?? mealSlots[0];

  const handleBook = async () => {
    if (!slot) return;
    setBooking(true);
    try {
      const reservation = await bookTable(slot.slot_id, guests);
      // MH-05: the hiker completes the booking with the party requirements
      const state: PartyRequirementsState = {reservation, slot};
      navigate(`/book/${reservation.reservation_id}/requirements`, {state});
    } catch (err) {
      toast.error((err as Error).message);
      // the free seats may have changed, load them again
      setReload((r) => r + 1);
      setBooking(false);
    }
  };

  const emptyMessage = loading
    ? null
    : loaded.error
      ? loaded.error
      : bookable.length === 0
        ? `No time slot on this day has room for ${guests} ${guests === 1 ? "guest" : "guests"}. Bookings close 2 hours before the meal: try another date or fewer guests.`
        : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 text-[#23404d]">
      <h1 className="text-2xl font-semibold">Book a Table</h1>
      <p className="text-sm">Reservation at Fond des Fours Mountain Hut</p>

      <div className="mt-6 grid gap-8 md:grid-cols-[3fr_2fr]">
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-8 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
          <label className={labelClass}>
            Date
            <input
              type="date"
              value={date}
              min={toInputDate(new Date())}
              onChange={(e) => setDate(e.target.value)}
                            className={`${fieldClass} text-center`}
            />
          </label>

          <div className={labelClass}>
            <span id="guests-label">Number of Guests</span>
            <div className="flex gap-2">
              <div
                aria-labelledby="guests-label"
                aria-live="polite"
                className={`${fieldClass} flex-1`}
              >
                {guests} {guests === 1 ? "Guest" : "Guests"}
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
                    {formatTime(s.date_time_start)} -{" "}
                    {formatTime(s.date_time_end)}
                  </option>
                ))
              )}
            </select>
          </label>

          {emptyMessage && (
            <p role="status" className="text-sm text-[#cc6000]">
              {emptyMessage}
            </p>
          )}
        </section>

        <section className="flex flex-col rounded-2xl bg-white p-8 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-[#cc6000]">
              Reservation Summary
            </h2>
            <p className="text-sm">Check before confirmation</p>
          </div>

          <dl className="mt-8 flex flex-col gap-6 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Meal</dt>
              <dd>{slot ? mealOf(slot) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Guests</dt>
              <dd>{guests}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Date and Time</dt>
              <dd>
                {slot
                  ? `${formatDate(slot.date_time_start)}, ${formatTime(slot.date_time_start)}`
                  : "—"}
              </dd>
            </div>
          </dl>

          {slot && (
            <p role="status" className="mt-6 text-center text-xs text-green-700">
              {slot.free_seats} {slot.free_seats === 1 ? "seat" : "seats"} free
            </p>
          )}

          <button
            type="button"
            onClick={handleBook}
            disabled={!slot || loading || booking}
            className="mt-4 cursor-pointer self-center rounded-lg bg-[#cc6000] px-6 py-2 text-lg font-semibold text-white shadow-md transition hover:bg-[#b35400] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {booking ? "Finding a table…" : "Find a Table and Book"}
          </button>
        </section>
      </div>

      <ConfirmationEmailNote />
    </div>
  );
}
