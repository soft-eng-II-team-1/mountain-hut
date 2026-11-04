import {useEffect, useState} from "react";
import {
  bookTable,
  checkAvailability,
  getBookableSlots,
} from "../../../api/reservations";
import {ApiError} from "../../../api/client";
import {toast} from "../../../components/popup";
import {
  dayRange,
  formatDate,
  formatTime,
  mealOf,
  toInputDate,
  type Meal,
} from "../../../lib/slotTime";
import type {Reservation, Slot} from "../../../types";

// MH-01: a hiker can book up to 2 hours before the slot starts
const BOOKING_CUTOFF_MS = 2 * 60 * 60 * 1000;
const MIN_GUESTS = 1;
const MAX_GUESTS = 30;

type LoadedSlots = {
  // date + reload counter they were loaded for
  key: string;
  slots: Slot[];
  // when they were loaded, to apply the 2 hour cutoff
  at: number;
  // set when the backend refuses to list slots
  error?: string;
};

type AvailabilityState = {
  key: string;
  ok: boolean;
  message: string;
};

const fieldClass =
  "w-full rounded-md border border-gray-400 bg-[#f1f1f1] px-3 py-2 text-sm text-[#23404d] outline-none focus:border-[#24414f] disabled:cursor-not-allowed disabled:text-gray-400";

const labelClass = "flex flex-col gap-1 text-sm text-[#23404d]";

const stepClass =
  "flex h-[38px] w-10 cursor-pointer items-center justify-center rounded-md border border-gray-400 bg-[#f1f1f1] text-lg text-[#23404d] transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50";

export default function BookTablePage() {
  const [date, setDate] = useState(() => toInputDate(new Date()));
  const [guests, setGuests] = useState(2);
  const [loaded, setLoaded] = useState<LoadedSlots | null>(null);
  // bumped to load the same day again (e.g. after a booking)
  const [reload, setReload] = useState(0);
  const loadKey = `${date}#${reload}`;
  const [chosenMeal, setChosenMeal] = useState<Meal | "">("");
  const [chosenSlotId, setChosenSlotId] = useState("");
  const [availability, setAvailability] = useState<AvailabilityState | null>(
    null,
  );
  // bumped to check the free seats again (e.g. after a failed booking)
  const [recheck, setRecheck] = useState(0);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<{
    reservation: Reservation;
    slot: Slot;
  } | null>(null);

  // load the slots of the chosen day
  useEffect(() => {
    if (!date) return;
    const key = `${date}#${reload}`;
    let cancelled = false;
    const {from, to} = dayRange(date);
    getBookableSlots(from, to)
      .then((slots) => {
        if (!cancelled) setLoaded({key, slots, at: Date.now()});
      })
      .catch((err: Error) => {
        if (cancelled) return;
        const error =
          err instanceof ApiError && err.status === 403
            ? "Online booking times are not open yet. Please try again later."
            : err.message;
        setLoaded({key, slots: [], at: Date.now(), error});
      });
    return () => {
      cancelled = true;
    };
  }, [date, reload]);

  const loading = loaded?.key !== loadKey;
  const allSlots = loading ? [] : loaded.slots;
  const bookable = loading
    ? []
    : allSlots.filter(
        (s) =>
          new Date(s.date_time_start).getTime() - loaded.at >=
          BOOKING_CUTOFF_MS,
      );

  const meals = [...new Set(bookable.map(mealOf))];
  const meal = meals.includes(chosenMeal as Meal) ? chosenMeal : meals[0];
  const mealSlots = bookable.filter((s) => mealOf(s) === meal);
  const slot =
    mealSlots.find((s) => s.slot_id === chosenSlotId) ?? mealSlots[0];

  // check that the party fits whenever the slot or the party size changes
  const availabilityKey = slot ? `${slot.slot_id}:${guests}:${recheck}` : "";
  useEffect(() => {
    if (!availabilityKey) return;
    let cancelled = false;
    const [slotId] = availabilityKey.split(":");
    checkAvailability(slotId, guests)
      .then((a) => {
        if (cancelled) return;
        setAvailability({
          key: availabilityKey,
          ok: true,
          message: `${a.totalAvailableSeats} seats free`,
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setAvailability({key: availabilityKey, ok: false, message: err.message});
      });
    return () => {
      cancelled = true;
    };
  }, [availabilityKey, guests]);

  const checking = !!slot && availability?.key !== availabilityKey;
  const fits = !checking && !!availability?.ok;

  const handleBook = async () => {
    if (!slot) return;
    setBooking(true);
    try {
      const reservation = await bookTable(slot.slot_id, guests);
      setBooked({reservation, slot});
      toast.success("Your table is booked!");
    } catch (err) {
      toast.error((err as Error).message);
      // the free seats may have changed, check again
      setRecheck((r) => r + 1);
    } finally {
      setBooking(false);
    }
  };

  const resetBooking = () => {
    setBooked(null);
    // reload the day so the free seats are current
    setReload((r) => r + 1);
  };

  const emptyMessage = loading
    ? null
    : loaded.error
      ? loaded.error
      : allSlots.length === 0
        ? "There are no meal services on this day. Please pick another date."
        : bookable.length === 0
          ? "Bookings for this day are closed: you can book up to 2 hours before the meal."
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
              disabled={!!booked}
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
                disabled={!!booked || guests >= MAX_GUESTS}
                className={stepClass}
              >
                +
              </button>
              <button
                type="button"
                aria-label="Remove a guest"
                onClick={() => setGuests((g) => Math.max(MIN_GUESTS, g - 1))}
                disabled={!!booked || guests <= MIN_GUESTS}
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
              disabled={!!booked || meals.length === 0}
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
              disabled={!!booked || mealSlots.length === 0}
              className={`${fieldClass} cursor-pointer`}
            >
              {mealSlots.length === 0 ? (
                <option value="">{loading ? "Loading…" : "—"}</option>
              ) : (
                mealSlots.map((s) => (
                  <option key={s.slot_id} value={s.slot_id}>
                    {formatTime(s.date_time_start)}
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
          {booked ? (
            <BookingConfirmed
              reservation={booked.reservation}
              slot={booked.slot}
              onBookAnother={resetBooking}
            />
          ) : (
            <>
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
                <p
                  role="status"
                  className={`mt-6 text-center text-xs ${
                    checking
                      ? "text-gray-500"
                      : fits
                        ? "text-green-700"
                        : "text-red-600"
                  }`}
                >
                  {checking ? "Checking availability…" : availability?.message}
                </p>
              )}

              <button
                type="button"
                onClick={handleBook}
                disabled={!slot || !fits || booking}
                className="mt-4 cursor-pointer self-center rounded-lg bg-[#cc6000] px-6 py-2 text-lg font-semibold text-white shadow-md transition hover:bg-[#b35400] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {booking ? "Booking…" : "Find a Table and Book"}
              </button>
            </>
          )}
        </section>
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 text-sm">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
        A confirmation email will be sent to your address.
      </p>
    </div>
  );
}

type BookingConfirmedProps = {
  reservation: Reservation;
  slot: Slot;
  onBookAnother: () => void;
};

function BookingConfirmed({
  reservation,
  slot,
  onBookAnother,
}: BookingConfirmedProps) {
  return (
    <div className="flex flex-1 flex-col text-center">
      <h2 className="text-xl font-semibold text-[#cc6000]">
        Table Booked
      </h2>
      <p className="text-sm">
        {mealOf(slot)} on {formatDate(slot.date_time_start)} at{" "}
        {formatTime(slot.date_time_start)} for {reservation.people}{" "}
        {reservation.people === 1 ? "guest" : "guests"}.
      </p>

      <ul className="mt-6 flex flex-col gap-2 text-sm">
        {reservation.tables.map((t) => (
          <li
            key={t.table_id}
            className="flex justify-between rounded-md border border-gray-300 px-3 py-2"
          >
            <span>Table {t.number}</span>
            <span>
              {t.seats_reserved} {t.seats_reserved === 1 ? "seat" : "seats"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-gray-500">
        Tables are shared with other parties.
      </p>

      <button
        type="button"
        onClick={onBookAnother}
        className="mt-auto cursor-pointer self-center rounded-lg border border-[#24414f] px-5 py-1.5 text-xs font-semibold transition hover:bg-[#24414f] hover:text-white"
      >
        Book another meal
      </button>
    </div>
  );
}
