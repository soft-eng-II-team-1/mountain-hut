import {useEffect, useMemo, useState} from "react";
import PageHeader from "../components/PageHeader";
import NewSlotModal from "../components/NewSlotModal";
import {getAllTables, getSlots, updateSlot} from "../../../api/slots";
import {toast} from "../../../components/popup";
import type {Slot, Table} from "../../../types";
import {dayRange, slotLabel, toInputDate} from "../../../lib/slotTime";

const byNumber = (a: Table, b: Table) =>
  a.number.localeCompare(b.number, undefined, {numeric: true});

const sameIds = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

const byStart = (a: Slot, b: Slot) =>
  a.date_time_start.localeCompare(b.date_time_start);

// MH-02: create time slots and pick which tables (and so how many seats) each has
export default function TimeSlotManagementPage() {
  const [date, setDate] = useState(() => toInputDate(new Date()));
  const [tables, setTables] = useState<Table[]>([]);
  // slots of the day they were loaded for; a different day means still loading
  const [loaded, setLoaded] = useState<{date: string; slots: Slot[]} | null>(
    null,
  );
  const [chosenSlotId, setChosenSlotId] = useState("");
  // unsaved checkbox changes, kept only for the slot they were made on
  const [edits, setEdits] = useState<{slotId: string; ids: Set<string>} | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadingSlots = loaded?.date !== date;
  const slots = loadingSlots ? [] : loaded.slots;
  const slot = slots.find((s) => s.slot_id === chosenSlotId) ?? slots[0];

  useEffect(() => {
    getAllTables()
      .then((t) => setTables([...t].sort(byNumber)))
      .catch((err: Error) => toast.error(err.message));
  }, []);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    const {from, to} = dayRange(date);
    getSlots(from, to)
      .then((list) => !cancelled && setLoaded({date, slots: list}))
      .catch((err: Error) => {
        if (cancelled) return;
        setLoaded({date, slots: []});
        toast.error(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const saved = useMemo(
    () => new Set(slot?.tables.map((t) => t.table_id) ?? []),
    [slot],
  );
  const selected = edits && edits.slotId === slot?.slot_id ? edits.ids : saved;
  const dirty = !!slot && !sameIds(selected, saved);
  // the backend only accepts changes to slots that have not started yet
  const started = !!slot && new Date(slot.date_time_start) <= new Date();

  const enabledTables = tables.filter((t) => selected.has(t.table_id));
  const activeSeats = enabledTables.reduce((sum, t) => sum + t.seats, 0);

  const toggle = (tableId: string) => {
    if (!slot) return;
    const next = new Set(selected);
    if (next.has(tableId)) next.delete(tableId);
    else next.add(tableId);
    setEdits({slotId: slot.slot_id, ids: next});
  };

  // show the new slot: same day -> add it to the list, other day -> load that day
  const handleCreated = (created: Slot) => {
    setCreating(false);
    setChosenSlotId(created.slot_id);
    const createdDate = toInputDate(new Date(created.date_time_start));
    if (createdDate === date && loaded?.date === date) {
      setLoaded({date, slots: [...loaded.slots, created].sort(byStart)});
    } else {
      setDate(createdDate);
    }
    toast.success(
      `Created ${slotLabel(created)} on ${new Date(created.date_time_start).toLocaleDateString()}.`,
    );
  };

  const handleSave = async () => {
    if (!slot) return;
    setSaving(true);
    try {
      const updated = await updateSlot(slot.slot_id, {
        date_time_start: slot.date_time_start,
        date_time_end: slot.date_time_end,
        table_ids: [...selected],
      });
      setLoaded(
        (prev) =>
          prev && {
            ...prev,
            slots: prev.slots.map((s) =>
              s.slot_id === updated.slot_id ? updated : s,
            ),
          },
      );
      setEdits(null);
      toast.success(
        `Saved ${updated.total_seats} seats for ${slotLabel(updated)}.`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Time Slot and Capacity Management"
        subtitle="Dashboard for actual schedule allocation and capacity assignments."
      />

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <label className="flex flex-col gap-2">
            <span className="font-medium">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44 rounded-sm border border-gray-400 px-3 py-1.5 text-sm focus:border-[#24414f] focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-medium">Time Slot</span>
            <select
              value={slot?.slot_id ?? ""}
              onChange={(e) => setChosenSlotId(e.target.value)}
              disabled={loadingSlots || slots.length === 0}
              className="w-56 cursor-pointer rounded-sm border border-gray-400 bg-white px-3 py-1.5 text-sm focus:border-[#24414f] focus:outline-none disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {loadingSlots ? (
                <option>Loading…</option>
              ) : slots.length === 0 ? (
                <option>No slots on this day</option>
              ) : (
                slots.map((s) => (
                  <option key={s.slot_id} value={s.slot_id}>
                    {slotLabel(s)}
                  </option>
                ))
              )}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="cursor-pointer self-end rounded-lg bg-[#24414f] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#1c3440] sm:ml-auto"
          >
            New Slot
          </button>
        </div>

        {!loadingSlots && !slot ? (
          <p className="mt-8 text-sm text-gray-500">
            There are no time slots on this day. Pick another date or create
            one with "New Slot".
          </p>
        ) : (
          <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <fieldset disabled={!slot || started || saving}>
              <legend className="mb-3 font-medium">
                Table Assignment for fleet
              </legend>
              {tables.length === 0 ? (
                <p className="text-sm text-gray-500">No tables yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {tables.map((t) => {
                    const checked = selected.has(t.table_id);
                    return (
                      <label
                        key={t.table_id}
                        className={`flex w-44 cursor-pointer items-center gap-4 rounded-sm border border-gray-400 px-2.5 py-1.5 text-sm transition ${
                          checked ? "bg-[#d5dbe0]" : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(t.table_id)}
                          className="h-3.5 w-3.5 cursor-pointer accent-[#24414f]"
                        />
                        <span>
                          {t.number} - {t.seats} Seats
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <div className="flex w-full flex-col items-center gap-1 rounded-md border border-gray-300 px-6 py-8 text-center md:w-56">
              <p className="mb-3 font-medium text-[#cc6000]">
                Slot Capacity Summary
              </p>
              <p className="font-semibold">{activeSeats} Active Seats</p>
              <p className="text-xs">
                ({enabledTables.length} Enabled{" "}
                {enabledTables.length === 1 ? "Table" : "Tables"})
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || started || saving}
                className="mt-3 cursor-pointer rounded-md bg-[#cc6000] px-8 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b35400] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {started && (
                <p className="mt-2 text-xs text-gray-500">
                  This slot has already started, so it can't be changed.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {creating && (
        <NewSlotModal
          initialDate={date}
          // reuse the tables of the slot on screen (MH-02), else all of them
          tableIds={
            slot
              ? slot.tables.map((t) => t.table_id)
              : tables.map((t) => t.table_id)
          }
          tablesSource={
            slot ? `the tables of ${slotLabel(slot)}` : "all the tables"
          }
          onCreated={handleCreated}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
