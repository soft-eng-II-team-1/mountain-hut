import {useRef, useState} from "react";
import {Navigate, useLocation, useNavigate} from "react-router";
import {bookTable} from "../../../api/reservations";
import {toast} from "../../../components/popup";
import {formatDate, formatTime, mealOf} from "../../../lib/slotTime";
import type {
  BookableSlot,
  PartyRequirement,
  SlotAvailability,
} from "../../../types";
import ConfirmationEmailNote from "../components/ConfirmationEmailNote";
import RequirementRow from "../components/RequirementRow";
import {seatingOf} from "../lib/seating";

// what the Book a Table page passes when it navigates here
export type PartyRequirementsState = {
  slot: BookableSlot;
  people: number;
  // tables the party would get, the backend picks them again when booking
  tables: SlotAvailability["suggestedTables"];
};

type RequirementDraft = PartyRequirement & {key: number};

const cardClass =
  "rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]";

// MH-05: before confirming the booking, the hiker adds the dietary restrictions and allergies of the party
export default function PartyRequirementsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const booked = location.state as PartyRequirementsState | null;

  const [requirements, setRequirements] = useState<RequirementDraft[]>([]);
  // key of the row added last, its text field gets the focus
  const [addedKey, setAddedKey] = useState<number | null>(null);
  const nextKey = useRef(0);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  // reached without picking a slot first (e.g. typed URL): start from the booking page
  if (!booked) {
    return <Navigate to="/book" replace />;
  }
  const {slot, people, tables} = booked;

  const errorOf = (r: PartyRequirement) =>
    showErrors && !r.description.trim()
      ? r.allergies
        ? "Describe the allergy so the hut can prepare a safe meal."
        : "Describe the requirement or remove it."
      : undefined;

  const addRequirement = () => {
    const key = nextKey.current++;
    setRequirements((rs) => [...rs, {key, allergies: false, description: ""}]);
    setAddedKey(key);
  };

  const updateRequirement = (key: number, changed: PartyRequirement) =>
    setRequirements((rs) =>
      rs.map((r) => (r.key === key ? {...r, ...changed} : r)),
    );

  const removeRequirement = (key: number) =>
    setRequirements((rs) => rs.filter((r) => r.key !== key));

  const handleConfirm = async () => {
    if (requirements.some((r) => !r.description.trim())) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      // the reservation is created (and the confirmation email sent) only now
      await bookTable(
        slot.slot_id,
        people,
        requirements.map(({allergies, description}) => ({
          allergies,
          description: description.trim(),
        })),
      );
      toast.success("Your booking is confirmed!");
      navigate("/");
    } catch (err) {
      toast.error((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 text-[#23404d]">
      <h1 className="text-2xl font-semibold">Complete your Booking</h1>
      <p className="text-sm">
        Add dietary restrictions and allergies. You can always edit them until
        48h before your reservation.
      </p>

      <div className="mt-6 grid gap-8 md:grid-cols-[2fr_3fr]">
        <section
          aria-labelledby="summary-title"
          className={`${cardClass} flex flex-col overflow-hidden self-start`}
        >
          <h2
            id="summary-title"
            className="px-8 pt-8 text-center text-xl font-semibold"
          >
            Reservation Summary
          </h2>

          <dl className="flex flex-col gap-8 px-8 py-8 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Meal</dt>
              <dd>{mealOf(slot)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Guests</dt>
              <dd>{people}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Date and Time</dt>
              <dd>
                {formatDate(slot.date_time_start)},{" "}
                {formatTime(slot.date_time_start)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Seating</dt>
              <dd>{seatingOf(tables)}</dd>
            </div>
          </dl>

          <p
            role="status"
            className="bg-[rgba(59,98,69,0.2)] py-2 text-center text-base"
          >
            ✅ Available
          </p>
        </section>

        <div className="flex flex-col gap-8">
          <section
            aria-labelledby="requirements-title"
            className={`${cardClass} flex flex-col gap-5 p-8`}
          >
            <h2 id="requirements-title" className="text-xl font-semibold">
              Dietary Restrictions and Allergies:
            </h2>

            {requirements.length > 0 && (
              <ul className="flex flex-col gap-4">
                {requirements.map((r, i) => (
                  <RequirementRow
                    key={r.key}
                    index={i + 1}
                    requirement={r}
                    autoFocus={r.key === addedKey}
                    error={errorOf(r)}
                    onChange={(changed) => updateRequirement(r.key, changed)}
                    onRemove={() => removeRequirement(r.key)}
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
          </section>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="mt-auto cursor-pointer self-end rounded-lg bg-[#24414f] px-6 py-2 text-lg font-bold text-white shadow-md transition hover:bg-[#1c3440] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Confirming…" : "Confirm Booking"}
          </button>
        </div>
      </div>

      <ConfirmationEmailNote />
    </div>
  );
}
