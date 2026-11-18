// GET /api/slots/available: a slot a hiker can book
export type BookableSlot = {
  slot_id: string;
  date_time_start: string;
  date_time_end: string;
  free_seats: number;
};

// POST /api/slots/:slotId/reservations
export type Reservation = {
  reservation_id: string;
  people: number;
  slot_id: string;
  user_id: string;
  // tables the backend picked for the party (MH-01 table assignment)
  tables: {table_id: string; number: string; seats_reserved: number}[];
};

// MH-05: one dietary requirement of (a subset of) the party,
// e.g. {allergies: true, description: "1 vegan, peanut allergy"}
export type PartyRequirement = {
  // the kitchen must take special care while preparing the meal
  allergies: boolean;
  description: string;
};

// GET /api/reservations/:reservationId (and each item of GET /api/reservations)
export type ReservationDetails = {
  reservation_id: string;
  people: number;
  requirements: PartyRequirement[];
  has_allergies: boolean;
  slot: {slot_id: string; date_time_start: string; date_time_end: string};
  tables: {table_id: string; number: string; seats_reserved: number}[];
};

// PUT /api/reservations/:reservationId: the full new state of the booking
export type ReservationUpdate = {
  slot_id: string;
  people: number;
  requirements: PartyRequirement[];
};
