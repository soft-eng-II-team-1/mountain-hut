import { useEffect, useState, type FormEvent } from "react";
import * as tableApi from "../../../api/tables";
import type { Table } from "../../../types";
import { toast } from "../../../components/popup";

type ModalState =
  | { open: false }
  | { open: true; mode: "create"; tableNumber: string; seats: string }
  | {
      open: true;
      mode: "edit";
      tableId: string;
      tableNumber: string;
      seats: string;
    };

// Helper to compute the next Table ID (e.g., T01..T05 -> T06)
function getNextTableNumber(tables: Table[]): string {
  const nums = tables
    .map((t) => {
      const match = t.number.match(/^T(\d+)$/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `T${String(next).padStart(2, "0")}`;
}

export default function TableManagementPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false });

  useEffect(() => {
    let active = true;

    const loadTables = async () => {
      try {
        const data = await tableApi.getTables();
        if (!active) return;
        // Sort by table number (T01, T02, ...)
        const sorted = [...data].sort((a, b) =>
          a.number.localeCompare(b.number, undefined, { numeric: true }),
        );
        setTables(sorted);
      } catch (err) {
        if (!active) return;
        toast.error((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadTables();

    return () => {
      active = false;
    };
  }, []);

  const handleOpenCreate = () => {
    const nextNumber = getNextTableNumber(tables);
    setModal({
      open: true,
      mode: "create",
      tableNumber: nextNumber,
      seats: "",
    });
  };

  const handleOpenEdit = (table: Table) => {
    setModal({
      open: true,
      mode: "edit",
      tableId: table.table_id,
      tableNumber: table.number,
      seats: String(table.seats),
    });
  };

  const handleDelete = async (table: Table) => {
    try {
      await tableApi.deleteTable(table.table_id);
      setTables((prev) => prev.filter((t) => t.table_id !== table.table_id));
      toast.success(`Table ${table.number} deleted.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleConfirmModal = async (e: FormEvent) => {
    e.preventDefault();
    if (!modal.open) return;

    const seatsNum = Number(modal.seats);
    if (!Number.isInteger(seatsNum) || seatsNum <= 0) {
      toast.error("Please enter a valid positive integer for seats.");
      return;
    }

    setSubmitting(true);
    try {
      if (modal.mode === "create") {
        const created = await tableApi.createTable({
          number: modal.tableNumber,
          seats: seatsNum,
        });
        setTables((prev) =>
          [...prev, created].sort((a, b) =>
            a.number.localeCompare(b.number, undefined, { numeric: true }),
          ),
        );
        toast.success(`Table ${created.number} created.`);
      } else {
        const updated = await tableApi.updateTable(modal.tableId, {
          number: modal.tableNumber,
          seats: seatsNum,
        });
        setTables((prev) =>
          prev.map((t) => (t.table_id === updated.table_id ? updated : t)),
        );
        toast.success(`Table ${updated.number} updated.`);
      }
      setModal({ open: false });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#23404d]">Table Management</h1>
        <p className="mt-1 text-base text-[#23404d]/80">
          Dashboard for physical tables registry
        </p>
      </div>

      {/* Main Registry Card */}
      <div className="relative rounded-xl border border-gray-300 bg-white p-8 shadow-xs">
        {/* Card Header + Add Button */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold text-[#23404d]">
              Physical Tables Registry
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-[#23404d]/80">
              Modify the base physical table fleet.
              <br />
              Tables with active slot schedule cannot be deleted.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="cursor-pointer self-start rounded-lg bg-[#24414f] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#1c3440] sm:self-center"
          >
            Add a Table
          </button>
        </div>

        {/* Tables List Container */}
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-300">
          <div className="border-b border-gray-300 bg-[#f0f3f5] px-5 py-3.5 text-sm font-semibold text-[#23404d]">
            Tables
          </div>

          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-[#23404d]/60">
              Loading tables...
            </div>
          ) : tables.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#23404d]/60">
              No physical tables registered yet. Click "Add a Table" to create one.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 bg-white">
              {tables.map((table) => (
                <li
                  key={table.table_id}
                  className="flex items-center justify-between px-5 py-3.5 text-sm text-[#23404d]"
                >
                  <span>
                    {table.number} – {table.seats} Seats
                  </span>

                  <div className="flex items-center gap-3">
                    {/* Edit Button (Pencil Icon) */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(table)}
                      aria-label={`Edit ${table.number}`}
                      className="cursor-pointer p-1 text-[#23404d]/80 transition hover:text-[#23404d]"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </button>

                    {/* Delete Button (Trash Icon) */}
                    <button
                      type="button"
                      onClick={() => handleDelete(table)}
                      aria-label={`Delete ${table.number}`}
                      className="cursor-pointer p-1 text-[#23404d]/80 transition hover:text-red-600"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        <line x1="10" x2="10" y1="11" y2="17" />
                        <line x1="14" x2="14" y1="11" y2="17" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Centered Popover Modal for New Table / Edit Table */}
        {modal.open && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/10"
            onClick={() => !submitting && setModal({ open: false })}
          >
            <form
              onSubmit={handleConfirmModal}
              onClick={(e) => e.stopPropagation()}
              className="w-80 rounded-xl border border-gray-300 bg-white p-6 shadow-lg"
            >
              <h3 className="text-base font-bold text-[#c65d00]">
                {modal.mode === "create" ? "New Table" : "Edit Table"}
              </h3>

              <p className="mt-3 text-sm text-[#23404d]">
                <span className="font-semibold">Table ID:</span>{" "}
                {modal.tableNumber}
              </p>

              <div className="mt-3 flex items-center justify-between gap-3">
                <label
                  htmlFor="seats-input"
                  className="text-sm font-semibold text-[#23404d] whitespace-nowrap"
                >
                  Insert the Number of Seats:
                </label>
                <input
                  id="seats-input"
                  type="number"
                  min={1}
                  required
                  autoFocus
                  value={modal.seats}
                  onChange={(e) =>
                    setModal({ ...modal, seats: e.target.value })
                  }
                  className="w-20 rounded-xs border border-gray-300 px-2 py-1 text-right text-sm text-[#23404d] outline-none focus:border-[#24414f]"
                />
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  type="submit"
                  disabled={submitting}
                  className="cursor-pointer rounded-lg bg-[#c65d00] px-7 py-1.5 text-xs font-semibold text-white transition hover:bg-[#a84f00] disabled:opacity-60"
                >
                  {submitting ? "..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}