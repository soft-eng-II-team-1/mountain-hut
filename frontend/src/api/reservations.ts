import {request} from "./client";
import type {BookableSlot, PartyRequirement, Reservation} from "../types";

// MH-01: slots between two dates that still have `partySize` free seats.
// The backend leaves out slots that start in less than 2 hours
export const getBookableSlots = (from: Date, to: Date, partySize: number) => {
  const params = new URLSearchParams({
    partySize: String(partySize),
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return request<BookableSlot[]>(`/api/slots/available?${params}`);
};

// MH-01: book a table for the logged-in hiker; the backend picks the tables
export const bookTable = (slotId: string, people: number) =>
  request<Reservation>(`/api/slots/${slotId}/reservations`, "POST", {people});

// MH-05: save the dietary requirements and allergies of the party,
// replacing the ones saved before (an empty list means none)
export const savePartyRequirements = (
  reservationId: string,
  requirements: PartyRequirement[],
) =>
  request<void>(
    `/api/reservations/${reservationId}/requirements`,
    "PUT",
    {requirements},
  );
