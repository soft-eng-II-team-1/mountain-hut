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
