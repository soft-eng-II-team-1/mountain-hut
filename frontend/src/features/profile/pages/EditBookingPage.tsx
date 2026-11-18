import {useEffect, useState, type ReactNode} from "react";
import {Navigate, useNavigate, useParams} from "react-router";
import {getBookableSlots, updateReservation} from "../../../api/reservations";
import {toast} from "../../../components/popup";
import {
  dayRange,
  formatTime,
  mealOf,
  toInputDate,
  type Meal,
} from "../../../lib/slotTime";
import type {PartyRequirement, ReservationDetails} from "../../../types";
import RequirementRow from "../../booking/components/RequirementRow";
import {
  InfoBox,
  PageTitle,
  Panel,
  outlineButton,
  primaryButton,
} from "../components/BookingUi";
import {bookingRef, canChange} from "../lib/bookings";
import {useReservation} from "../lib/useReservation";
import {BackLink} from "./ReservationDetailsPage";

const MIN_GUESTS = 1;
const MAX_GUESTS = 30;

type SlotOption = {slot_id: string; date_time_start: string; date_time_end: string};
type RequirementDraft = PartyRequirement & {key: number};
type LoadedSlots = {key: string; slots: SlotOption[]; error?: string};

const fieldClass =
  "w-full rounded-md border border-gray-400 bg-white px-3 py-2 text-sm text-[#23404d] outline-none focus:border-[#24414f] disabled:cursor-not-allowed disabled:text-gray-400";

const stepClass =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-gray-400 bg-white text-lg transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50";

export default function EditBookingPage() {
  const {reservationId} = useParams();
  const state = useReservation(reservationId);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageTitle title="Edit Booking Details">
        Changes are approved only after an availability check.
      </PageTitle>

      {state.status === "loading" ? (
        <Panel>
          <p className="py-6 text-center">Loading...</p>
        </Panel>
      ) : state.status === "error" ? (
        <Panel>
          <p className="py-6 text-center">
            We couldn’t load this booking: {state.error}
          </p>
        </Panel>
      ) : !canChange(state.reservation) ? (
        // closed for changes (48h rule): the details page explains why
        <Navigate to=".." relative="path" replace />
      ) : (
        <EditForm reservation={state.reservation} />
      )}

      <BackLink />
    </div>
  );
}

function EditForm({reservation: r}: {reservation: ReservationDetails}) {
  const navigate = useNavigate();
  const detailsPath = `/profile/bookings/${r.reservation_id}`;
  const originalDate = toInputDate(new Date(r.slot.date_time_start));

  const [date, setDate] = useState(originalDate);
  const [guests, setGuests] = useState(r.people);
  const [chosenMeal, setChosenMeal] = useState<Meal>(mealOf(r.slot));
  const [chosenSlotId, setChosenSlotId] = useState(r.slot.slot_id);
  const [requirements, setRequirements] = useState<RequirementDraft[]>(() =>
    r.requirements.map((req, i) => ({...req, key: i})),
  );
  const [nextKey, setNextKey] = useState(r.requirements.length);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // slots of the chosen day with room for the party
  const loadKey = `${date}#${guests}`;
  const [loaded, setLoaded] = useState<LoadedSlots | null>(null);
  useEffect(() => {
    if (!date) return;
    const key = `${date}#${guests}`;
    let active = true;
    const {from, to} = dayRange(date);
    getBookableSlots(from, to, guests)
      .then((slots) => active && setLoaded({key, slots}))
      .catch((err: Error) => active && setLoaded({key, slots: [], error: err.message}));
    return () => {
      active = false;
    };
  }, [date, guests]);

  const loading = loaded?.key !== loadKey;
  // The current slot stays selectable: the seats this booking already holds may be
  // what makes it look full. The backend has the final word on availability.
  const options: SlotOption[] = loading ? [] : [...loaded.slots];
  if (!loading && date === originalDate && !options.some((s) => s.slot_id === r.slot.slot_id))
    options.push(r.slot);
  options.sort((a, b) => a.date_time_start.localeCompare(b.date_time_start));

  const meals = [...new Set(options.map(mealOf))];
  const meal = meals.includes(chosenMeal) ? chosenMeal : meals[0];
  const mealSlots = options.filter((s) => mealOf(s) === meal);
  const slot = mealSlots.find((s) => s.slot_id === chosenSlotId) ?? mealSlots[0];

  const requirementError = (req: PartyRequirement) =>
    showErrors && !req.description.trim()
      ? "Describe the requirement or remove it."
      : undefined;

  const addRequirement = () => {
    setRequirements((rs) => [...rs, {key: nextKey, allergies: false, description: ""}]);
    setLastAdded(nextKey);
    setNextKey((k) => k + 1);
  };

  const handleSave = async () => {
    setSaveError(null);
    if (requirements.some((req) => !req.description.trim())) {
      setShowErrors(true);
      return;
    }
    if (!slot) {
      setSaveError("Choose a time slot with room for your party.");
      return;
    }

    setSaving(true);
    try {
      await updateReservation(r.reservation_id, {
        slot_id: slot.slot_id,
        people: guests,
        requirements: requirements.map(({allergies, description}) => ({
          allergies,
          description: description.trim(),
        })),
      });
      toast.success("Your reservation has been updated.");
      navigate(detailsPath, {replace: true});
    } catch (err) {
      setSaveError((err as Error).message);
      setSaving(false);
    }
  };

  const slotHint = loading
    ? "Checking availability..."
    : loaded.error
      ? loaded.error
      : options.length === 0
        ? `No time slot on this day has room for ${guests} ${guests === 1 ? "guest" : "guests"}.`
        : null;

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-300 pb-4">
        <h3 className="text-2xl font-semibold">
          Booking #{bookingRef(r.reservation_id)}
        </h3>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(detailsPath)}
            disabled={saving}
            className={outlineButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !slot}
            className={primaryButton}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {saveError && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-md bg-[#8b0d0d] px-4 py-2 text-sm font-medium text-white"
        >
          <span aria-hidden="true">⚠</span>
          Update failed: {saveError}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <InfoBox title="General Details:">
          <div className="flex flex-col gap-4 text-sm">
            <FieldRow label="Meal" htmlFor="edit-meal">
              <select
                id="edit-meal"
                value={meal ?? ""}
                disabled={meals.length === 0}
                onChange={(e) => setChosenMeal(e.target.value as Meal)}
                className={fieldClass}
              >
                {meals.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </FieldRow>

            <FieldRow label="Date" htmlFor="edit-date">
              <input
                id="edit-date"
                type="date"
                value={date}
                min={toInputDate(new Date())}
                onChange={(e) => setDate(e.target.value)}
                className={fieldClass}
              />
            </FieldRow>

            <FieldRow label="Time Slot" htmlFor="edit-slot">
              <select
                id="edit-slot"
                value={slot?.slot_id ?? ""}
                disabled={mealSlots.length === 0}
                onChange={(e) => setChosenSlotId(e.target.value)}
                className={fieldClass}
              >
                {mealSlots.map((s) => (
                  <option key={s.slot_id} value={s.slot_id}>
                    {formatTime(s.date_time_start)} – {formatTime(s.date_time_end)}
                  </option>
                ))}
              </select>
            </FieldRow>

            <FieldRow label="Guests" htmlFor="edit-guests">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Remove a guest"
                  disabled={guests <= MIN_GUESTS}
                  onClick={() => setGuests((g) => g - 1)}
                  className={stepClass}
                >
                  −
                </button>
                <output
                  id="edit-guests"
                  className="flex h-9 w-12 items-center justify-center rounded-md border border-gray-400 bg-white"
                >
                  {guests}
                </output>
                <button
                  type="button"
                  aria-label="Add a guest"
                  disabled={guests >= MAX_GUESTS}
                  onClick={() => setGuests((g) => g + 1)}
                  className={stepClass}
                >
                  +
                </button>
              </div>
            </FieldRow>

            {slotHint && <p className="text-xs text-[#23404d]/80">{slotHint}</p>}
          </div>
        </InfoBox>

        <InfoBox title="Dietary Restrictions and Allergies:">
          {requirements.length > 0 && (
            <ul className="mb-3 flex flex-col gap-3">
              {requirements.map((req, i) => (
                <RequirementRow
                  key={req.key}
                  index={i + 1}
                  requirement={req}
                  autoFocus={req.key === lastAdded}
                  error={requirementError(req)}
                  onChange={(changed) =>
                    setRequirements((rs) =>
                      rs.map((x) => (x.key === req.key ? {...changed, key: req.key} : x)),
                    )
                  }
                  onRemove={() =>
                    setRequirements((rs) => rs.filter((x) => x.key !== req.key))
                  }
                />
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={addRequirement}
            className="cursor-pointer text-sm font-medium hover:underline"
          >
            + Add {requirements.length ? "another" : "a"} requirement
          </button>
        </InfoBox>
      </div>
    </Panel>
  );
}

function FieldRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
      <label htmlFor={htmlFor} className="font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
