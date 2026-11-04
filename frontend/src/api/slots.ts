import {request} from "./client";
import type {Slot, SlotInput, Table} from "../types";

// Slots that overlap [from, to)
export const getSlots = (from: Date, to: Date) => {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return request<Slot[]>(`/api/slots?${params}`);
};

export const updateSlot = (slotId: string, data: SlotInput) =>
  request<Slot>(`/api/slots/${slotId}`, "PUT", data);

// All tables of the hut, to pick from when assigning them to a slot
export const getAllTables = () => request<Table[]>("/api/tables");
