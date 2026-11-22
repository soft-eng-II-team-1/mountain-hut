import {useEffect, useState, type FormEvent} from "react";
import {useNavigate} from "react-router";
import {getBookableSlots, getSlotAvailability} from "../../../api/reservations";
import {ApiError} from "../../../api/client";
import cancelIcon from "../../../assets/icons/cancel.svg";
import checkIcon from "../../../assets/icons/check-circle.svg";
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

// outcome of the last check, for the inputs it was checked with
type Result = {key: string; available: boolean; message: string};

const fieldClass =
  "h-11 w-full rounded-md border border-gray-400 bg-[#f1f1f1] px-3 text-sm text-[#23404d] outline-none focus:border-[#24414f] disabled:cursor-not-allowed disabled:text-gray-400";

// compact box with the number of guests
const guestsClass = fieldClass.replace("w-full", "w-[4.4375rem] shrink-0");

const labelClass = "flex flex-col gap-1 text-sm text-[#23404d]";

const stepClass =
  "flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-400 bg-[#f1f1f1] text-lg text-[#23404d] transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50";

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

  // the banner is only shown for the inputs it was checked with
  const checkKey = `${date}#${slot?.slot_id}#${guests}`;
  const shown = result?.key === checkKey ? result : null;

  // staff cannot book from the website, the booking page is for hikers
  const canBook = !user || !STAFF_ROLES.includes(user.role);

  // nothing is reported until the button is pressed
  const handleCheck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    const key = checkKey;
    if (!slot) {
      setResult({
        key,
        available: false,
        message: loaded.error || noRoom(guests),
      });
      return;
    }
    setChecking(true);
    try {
      const availability = await getSlotAvailability(slot.slot_id, guests);
      setResult(
        availability.available
          ? {key, available: true, message: hasRoom(guests)}
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

  // the check is public; booking needs a hiker account, so a visitor goes through
  // the login page first and comes back to the booking page with the same choices
  const handleBook = () => {
    if (!slot) return;
    const state: BookTableState = {date, guests, slotId: slot.slot_id};
    if (user) navigate("/book", {state});
    else navigate("/login", {state: {from: "/book", fromState: state}});
  };

  const bannerClass =
    "mt-4 ml-auto flex w-fit items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-md md:absolute md:top-full md:right-0 md:mt-5";

  return (
    <div className="relative">
      <form
        onSubmit={handleCheck}
        aria-label="Check availability"
        className="rounded-xl bg-[#f7f8f9] p-5 shadow-[0_8px_20px_rgba(0,0,0,0.25)] md:px-8"
      >
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-[1.2fr_auto_1fr_1.2fr_auto] md:items-end">
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
                className={`${guestsClass} flex items-center`}
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
                    {formatTime(s.date_time_start)} -{" "}
                    {formatTime(s.date_time_end)}
                  </option>
                ))
              )}
            </select>
          </label>

          <button
            type="submit"
            disabled={loading || checking}
            className="h-11 cursor-pointer rounded-lg bg-[#4f6b77] px-6 font-semibold text-white shadow-md transition hover:bg-[#24414f] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 md:col-span-1"
          >
            {checking ? "Checking…" : "Check Availability"}
          </button>
        </div>
      </form>

      {/* below the bar on the right, over the page so nothing moves */}
      {shown &&
        (!shown.available ? (
          <p role="alert" className={`${bannerClass} bg-[#8a0404]`}>
            <img
              src={cancelIcon}
              alt=""
              aria-hidden="true"
              className="h-5 w-5"
            />
            {shown.message}
          </p>
        ) : canBook ? (
          <button
            type="button"
            onClick={handleBook}
            className={`${bannerClass} cursor-pointer bg-[#3b6245] transition hover:bg-[#2f4f37]`}
          >
            <img
              src={checkIcon}
              alt=""
              aria-hidden="true"
              className="h-5 w-5"
            />
            {shown.message}:{" "}
            <span className="font-semibold underline">Book now</span>
          </button>
        ) : (
          <p role="status" className={`${bannerClass} bg-[#3b6245]`}>
            <img
              src={checkIcon}
              alt=""
              aria-hidden="true"
              className="h-5 w-5"
            />
            {shown.message}
          </p>
        ))}
    </div>
  );
}

const hasRoom = (guests: number) =>
  `Tables available for ${guests} ${guests === 1 ? "guest" : "guests"}`;

const noRoom = (guests: number) =>
  `No tables available for ${guests} ${guests === 1 ? "guest" : "guests"}`;
