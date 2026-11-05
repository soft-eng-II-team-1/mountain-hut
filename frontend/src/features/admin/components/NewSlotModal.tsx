import {useState, type FormEvent} from "react";
import {createSlot} from "../../../api/slots";
import type {Slot} from "../../../types";

type NewSlotModalProps = {
  // date the form starts on ("YYYY-MM-DD")
  initialDate: string;
  // tables the new slot starts with (MH-02: reuse the table list of a previous slot)
  tableIds: string[];
  // shown to the user so they know where the tables come from
  tablesSource: string;
  onCreated: (slot: Slot) => void;
  onClose: () => void;
};

const inputClass =
  "w-full rounded-sm border border-gray-400 px-2 py-1 text-sm text-[#23404d] outline-none focus:border-[#24414f]";

// MH-02: an employee defines a new time slot (any start time and duration)
export default function NewSlotModal({
  initialDate,
  tableIds,
  tablesSource,
  onCreated,
  onClose,
}: NewSlotModalProps) {
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("14:00");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // date + time typed in the hut's local time
    const startAt = new Date(`${date}T${start}`);
    const endAt = new Date(`${date}T${end}`);

    if (endAt <= startAt) {
      setError("The end time must be after the start time.");
      return;
    }
    if (startAt <= new Date()) {
      setError("The slot must start in the future.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const slot = await createSlot({
        date_time_start: startAt.toISOString(),
        date_time_end: endAt.toISOString(),
        table_ids: tableIds,
      });
      onCreated(slot);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/10"
      onClick={() => !submitting && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="new-slot-title"
        className="w-80 rounded-xl border border-gray-300 bg-white p-6 shadow-lg"
      >
        <h3 id="new-slot-title" className="text-base font-bold text-[#c65d00]">
          New Time Slot
        </h3>

        <label className="mt-4 flex flex-col gap-1 text-sm font-semibold text-[#23404d]">
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="mt-3 flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-[#23404d]">
            Start
            <input
              type="time"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-[#23404d]">
            End
            <input
              type="time"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-[#23404d]/80">
          Starts with {tablesSource}. You can change the tables after creating
          it.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer rounded-lg border border-gray-300 px-5 py-1.5 text-xs font-semibold text-[#23404d] transition hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer rounded-lg bg-[#c65d00] px-7 py-1.5 text-xs font-semibold text-white transition hover:bg-[#a84f00] disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
