import {request} from "./client";
import type {
  BookableSlot,
  PartyRequirement,
  Reservation,
  ReservationDetails,
  ReservationUpdate,
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

// book a table for the logged-in hiker; the backend picks the tables
export const bookTable = (slotId: string, people: number) =>
  request<Reservation>(`/api/slots/${slotId}/reservations`, "POST", {people});

// save the dietary requirements and allergies of the party,
export const savePartyRequirements = (
  reservationId: string,
  requirements: PartyRequirement[],
) =>
  request<void>(`/api/reservations/${reservationId}/requirements`, "PUT", {
    requirements,
  });

// NOTE: not in the backend yet. Bookings of the logged-in hiker, any order
export const getMyReservations = () =>
  request<ReservationDetails[]>("/api/reservations");

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
