import type {Reservation} from "../../../types";

// "2 Tables (2+3)", "1 Table"
export const seatingOf = (tables: Pick<Reservation["tables"][number], "seats_reserved">[]) =>
  tables.length === 1
    ? "1 Table"
    : `${tables.length} Tables (${tables.map((t) => t.seats_reserved).join("+")})`;
