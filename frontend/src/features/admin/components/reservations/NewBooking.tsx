import {useEffect, useRef, useState} from "react";
import {getSlots} from "../../../../api/slots";
import {bookForHiker, getSlotAvailability} from "../../../../api/reservations";
import {ApiError} from "../../../../api/client";
import {toast} from "../../../../components/popup";
import {
  dayRange,
  formatDate,
  formatTime,
  mealOf,
  toInputDate,
  type Meal,
} from "../../../../lib/slotTime";
import type {
  PartyRequirement,
  Reservation,
  Slot,
  SlotAvailability,
  StaffBookingInput,
} from "../../../../types";
import RequirementRow from "../../../booking/components/RequirementRow";
import {seatingOf} from "../../../booking/lib/seating";
import Card from "./Card";
import {
  fullName,
  inputClass,
  outlineButton,
  primaryButton,
  type BookingHiker,
} from "./ui";

const MIN_GUESTS = 1;
const MAX_GUESTS = 30;

const stepClass =
  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-400 bg-white text-lg transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50";

type LoadedSlots = {date: string; slots: Slot[]; error?: string};
type RequirementDraft = PartyRequirement & {key: number};

// the slot and party the employee checked, with the tables the backend suggests
type Checked = {slot: Slot; guests: number; tables: SlotAvailability["suggestedTables"]};

export type BookedReservation = {
  reservation: Reservation;
  slot: Slot;
  requirements: PartyRequirement[];
};

type NewBookingProps = {
  hiker: BookingHiker;
  onBooked: (booked: BookedReservation) => void;
  onCancel: () => void;
};

// MH-07: date, party and slot first; after the availability check, the summary
// with the party requirements and the confirmation
export default function NewBooking({hiker, onBooked, onCancel}: NewBookingProps) {
  const [date, setDate] = useState(() => toInputDate(new Date()));
  const [guests, setGuests] = useState(2);
  const [loaded, setLoaded] = useState<LoadedSlots | null>(null);
  const [chosenMeal, setChosenMeal] = useState<Meal | "">("");
  const [chosenSlotId, setChosenSlotId] = useState("");
  const [checking, setChecking] = useState(false);
  // why the last check failed, shown as a banner under the card
  const [unavailable, setUnavailable] = useState("");
  const [checked, setChecked] = useState<Checked | null>(null);

  const [requirements, setRequirements] = useState<RequirementDraft[]>([]);
  const [addedKey, setAddedKey] = useState<number | null>(null);
  const nextKey = useRef(0);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  // every slot of the day: employees can book until the slot starts
  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    const {from, to} = dayRange(date);
    getSlots(from, to)
      .then((all) => {
        if (cancelled) return;
        // slots that already started cannot be booked
        const now = Date.now();
        const slots = all.filter(
          (s) => new Date(s.date_time_start).getTime() > now,
        );
        setLoaded({date, slots});
      })
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

  // any change to the details hides the result of the previous check
  const resetCheck = () => setUnavailable("");

  const noRoom = (n: number) =>
    `No tables available for ${n} ${n === 1 ? "guest" : "guests"}`;

  const handleCheck = async () => {
    if (!slot) return;
    setChecking(true);
    setUnavailable("");
    try {
      const availability = await getSlotAvailability(slot.slot_id, guests);
      if (!availability.available) setUnavailable(noRoom(guests));
      else setChecked({slot, guests, tables: availability.suggestedTables});
    } catch (err) {
      setUnavailable(
        err instanceof ApiError && err.status === 400
          ? noRoom(guests)
          : (err as Error).message,
      );
    } finally {
      setChecking(false);
    }
  };

  const addRequirement = () => {
    const key = nextKey.current++;
    setRequirements((rs) => [...rs, {key, allergies: false, description: ""}]);
    setAddedKey(key);
  };

  const errorOf = (r: PartyRequirement) =>
    showErrors && !r.description.trim()
      ? "Describe the requirement or remove it."
      : undefined;

  const handleConfirm = async () => {
    if (!checked) return;
    if (requirements.some((r) => !r.description.trim())) {
      setShowErrors(true);
      return;
    }
    if (requirements.length > checked.guests) {
      toast.error(
        `Add at most ${checked.guests} requirements, one for each group of the party.`,
      );
      return;
    }
    const list = requirements.map(({allergies, description}) => ({
      allergies,
      description: description.trim(),
    }));
    const who: StaffBookingInput =
      hiker.kind === "registered"
        ? {people: checked.guests, requirements: list, user_id: hiker.user_id}
        : {
            people: checked.guests,
            requirements: list,
            temporary_name: fullName(hiker),
            ...(hiker.phone ? {temporary_phone: hiker.phone} : {}),
          };

    setSaving(true);
    try {
      const reservation = await bookForHiker(checked.slot.slot_id, who);
      onBooked({reservation, slot: checked.slot, requirements: list});
    } catch (err) {
      // the seats may be gone in the meantime: back to the details
      if (err instanceof ApiError && (err.status === 400 || err.status === 409)) {
        setChecked(null);
        setUnavailable(err.message);
      } else toast.error((err as Error).message);
      setSaving(false);
    }
  };

  if (checked) {
    const {slot: s, guests: n, tables} = checked;
    return (
      <Card
        title="New Booking"
        actions={
          <>
            <button
              type="button"
              onClick={() => setChecked(null)}
              disabled={saving}
              className={outlineButton}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className={primaryButton}
            >
              {saving ? "Confirming…" : "Confirm"}
            </button>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <section aria-labelledby="staff-summary-title">
            <h3 id="staff-summary-title" className="mb-2 text-sm font-semibold">
              Reservation Summary
            </h3>
            <dl className="flex flex-col gap-4 rounded-lg border border-gray-300 bg-gray-100 p-5 text-sm">
              {[
                ["Meal", mealOf(s)],
                ["Guests", String(n)],
                ["Date", formatDate(s.date_time_start)],
                ["Time Slot", `${formatTime(s.date_time_start)} - ${formatTime(s.date_time_end)}`],
                ["Seating", seatingOf(tables)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="staff-requirements-title">
            <h3 id="staff-requirements-title" className="mb-2 text-sm font-semibold">
              Dietary Restrictions and Allergies:
            </h3>
            <div className="flex flex-col gap-4 rounded-lg border border-gray-300 bg-gray-100 p-5">
              {requirements.length > 0 && (
                <ul className="flex flex-col gap-4">
                  {requirements.map((r, i) => (
                    <RequirementRow
                      key={r.key}
                      index={i + 1}
                      requirement={r}
                      autoFocus={r.key === addedKey}
                      error={errorOf(r)}
                      onChange={(changed) =>
                        setRequirements((rs) =>
                          rs.map((x) => (x.key === r.key ? {...x, ...changed} : x)),
                        )
                      }
                      onRemove={() =>
                        setRequirements((rs) => rs.filter((x) => x.key !== r.key))
                      }
                    />
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={addRequirement}
                className="cursor-pointer self-start text-sm font-semibold hover:underline"
              >
                + Add new requirement
              </button>
            </div>
          </section>
        </div>
      </Card>
    );
  }

  const emptyMessage = loading
    ? null
    : loaded.error
      ? loaded.error
      : slots.length === 0
        ? "No time slots left on this day, try another date."
        : null;

  return (
    <Card
      title="New Booking"
      actions={
        <button type="button" onClick={onCancel} className={outlineButton}>
          Cancel
        </button>
      }
      footer={
        unavailable && (
          <p
            role="alert"
            className="flex items-center justify-center gap-2 bg-[#8b0000] px-6 py-2 text-sm font-medium text-white"
          >
            <span aria-hidden="true">✕</span> {unavailable}
          </p>
        )
      }
    >
      <h3 className="mb-2 text-sm font-semibold">General Details:</h3>
      <div className="rounded-lg border border-gray-300 bg-gray-100 p-5">
        <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
          <label className="flex items-center gap-4 text-sm">
            <span className="w-16 shrink-0">Date</span>
            <input
              type="date"
              value={date}
              min={toInputDate(new Date())}
              onChange={(e) => {
                setDate(e.target.value);
                resetCheck();
              }}
              className={inputClass}
            />
          </label>

          <div className="flex items-center gap-4 text-sm">
            <span id="staff-guests-label" className="w-16 shrink-0">
              Guests
            </span>
            <button
              type="button"
              aria-label="Add a guest"
              onClick={() => {
                setGuests((g) => Math.min(MAX_GUESTS, g + 1));
                resetCheck();
              }}
              disabled={guests >= MAX_GUESTS}
              className={stepClass}
            >
              +
            </button>
            <div
              aria-labelledby="staff-guests-label"
              aria-live="polite"
              className={`${inputClass} w-16 text-center`}
            >
              {guests}
            </div>
            <button
              type="button"
              aria-label="Remove a guest"
              onClick={() => {
                setGuests((g) => Math.max(MIN_GUESTS, g - 1));
                resetCheck();
              }}
              disabled={guests <= MIN_GUESTS}
              className={stepClass}
            >
              −
            </button>
          </div>

          <label className="flex items-center gap-4 text-sm">
            <span className="w-16 shrink-0">Meal</span>
            <select
              value={meal ?? ""}
              onChange={(e) => {
                setChosenMeal(e.target.value as Meal);
                resetCheck();
              }}
              disabled={meals.length === 0}
              className={`${inputClass} cursor-pointer`}
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

          <label className="flex items-center gap-4 text-sm">
            <span className="w-16 shrink-0">Time Slot</span>
            <select
              value={slot?.slot_id ?? ""}
              onChange={(e) => {
                setChosenSlotId(e.target.value);
                resetCheck();
              }}
              disabled={mealSlots.length === 0}
              className={`${inputClass} cursor-pointer`}
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
        </div>

        {emptyMessage && (
          <p role="status" className="mt-4 text-sm text-[#cc6000]">
            {emptyMessage}
          </p>
        )}

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleCheck}
            disabled={!slot || checking}
            className={`${primaryButton} w-full max-w-xs`}
          >
            {checking ? "Checking…" : "Check Availability"}
          </button>
        </div>
      </div>
    </Card>
  );
}
