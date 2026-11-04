// GET /api/slots/:slotId/availability?partySize=N (when the party fits)
export type Availability = {
  available: boolean;
  totalAvailableSeats: number;
  availableTables: {table_id: string; number: string; remainingSeats: number}[];
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
