import type {Table} from "./table";

// What GET /api/slots returns for each slot (dates are ISO strings)
export type Slot = {
  slot_id: string;
  date_time_start: string;
  date_time_end: string;
  tables: Table[];
  total_seats: number;
};

// Body of POST / PUT /api/slots. table_ids replaces the whole list
export type SlotInput = {
  date_time_start: string;
  date_time_end: string;
  table_ids: string[];
};
