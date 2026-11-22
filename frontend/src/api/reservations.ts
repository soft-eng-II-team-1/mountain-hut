import {request} from "./client";
import type {
  BookableSlot,
  PartyRequirement,
  Reservation,
  ReservationDetails,
  ReservationUpdate,
  SlotAvailability,
  StaffBookingInput,
} from "../types";

// The backend leaves out slots that start in less than 2 hours
export const getBookableSlots = (from: Date, to: Date, partySize: number) => {
  const params = new URLSearchParams({
    partySize: String(partySize),
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return request<BookableSlot[]>(`/api/slots/available?${params}`);
};

// MH-04: whether the party fits in the slot. Public, answers 400 when there is no room
export const getSlotAvailability = (slotId: string, partySize: number) =>
  request<SlotAvailability>(
    `/api/slots/${slotId}/availability?${new URLSearchParams({partySize: String(partySize)})}`,
  );

// book a table for the logged-in hiker; the backend picks the tables
// and sends the confirmation email (MH-03)
export const bookTable = (
  slotId: string,
  people: number,
  requirements: PartyRequirement[] = [],
) =>
  request<Reservation>(`/api/slots/${slotId}/reservations`, "POST", {
    people,
    requirements,
  });

// MH-07: an employee books for a registered hiker or a temporary contact.
// Employees can book until the slot starts (no 2-hour cutoff)
export const bookForHiker = (slotId: string, data: StaffBookingInput) =>
  request<Reservation>(
    `/api/slots/${slotId}/reservations/for-hiker`,
    "POST",
    data,
  );

// GET /api/reservations/user/active answers with the database rows as they are
type ActiveReservationRow = {
  reservation_id: string;
  people: number;
  has_allergies: boolean;
  slot: ReservationDetails["slot"];
  reservation_requirement: PartyRequirement[];
  reservation_table: {
    table_id: string;
    seats_reserved: number;
    table: {number: string};
  }[];
};

// Bookings of the logged-in hiker whose slot has not started yet, any order,
// in the same shape as the details of a single booking
export const getMyReservations = async (): Promise<ReservationDetails[]> => {
  const rows = await request<ActiveReservationRow[]>(
    "/api/reservations/user/active",
  );
  return rows.map((r) => ({
    reservation_id: r.reservation_id,
    people: r.people,
    has_allergies: r.has_allergies,
    requirements: r.reservation_requirement,
    slot: {
      slot_id: r.slot.slot_id,
      date_time_start: r.slot.date_time_start,
      date_time_end: r.slot.date_time_end,
    },
    tables: r.reservation_table.map((rt) => ({
      table_id: rt.table_id,
      number: rt.table.number,
      seats_reserved: rt.seats_reserved,
    })),
  }));
};

export const getReservation = (reservationId: string) =>
  request<ReservationDetails>(`/api/reservations/${reservationId}`);

// MH-06 (feat/backend-change-booking): slot, party size and requirements together,
// allowed up to 48h before the meal. The backend re-checks availability
export const updateReservation = (
  reservationId: string,
  data: ReservationUpdate,
) =>
  request<ReservationDetails>(
    `/api/reservations/${reservationId}`,
    "PUT",
    data,
  );

// NOTE: not in the backend yet. Cancels the booking, same 48h limit
export const cancelReservation = (reservationId: string) =>
  request<void>(`/api/reservations/${reservationId}`, "DELETE");
