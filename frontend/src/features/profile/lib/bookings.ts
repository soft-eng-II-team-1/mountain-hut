import type {ReservationDetails} from "../../../types";

// Changes and cancellations close 48 hours before the meal
export const CHANGE_LIMIT_HOURS = 48;

// Short code shown to the hiker; the full id is the reference in the confirmation email
export const bookingRef = (reservationId: string) =>
  reservationId.slice(0, 8).toUpperCase();

const startOf = (r: ReservationDetails) =>
  new Date(r.slot.date_time_start).getTime();

export const isUpcoming = (r: ReservationDetails) => startOf(r) > Date.now();

export const canChange = (r: ReservationDetails) =>
  startOf(r) - Date.now() >= CHANGE_LIMIT_HOURS * 60 * 60 * 1000;
