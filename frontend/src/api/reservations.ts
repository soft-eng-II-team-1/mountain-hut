import {request} from "./client";
import type {Availability, Reservation, Slot} from "../types";

// Slots a hiker can pick from, between two dates.
// Uses GET /api/slots, which the backend currently opens to staff only:
// hikers get 403 until the backend team allows them (see BookTablePage)
export const getBookableSlots = (from: Date, to: Date) => {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return request<Slot[]>(`/api/slots?${params}`);
};

// Whether a party of `partySize` fits in the free seats of the slot
export const checkAvailability = (slotId: string, partySize: number) =>
  request<Availability>(
    `/api/slots/${slotId}/availability?partySize=${partySize}`,
  );

// MH-01: book a table for the logged-in hiker; the backend picks the tables
export const bookTable = (slotId: string, people: number) =>
  request<Reservation>(`/api/slots/${slotId}/reservations`, "POST", {people});
