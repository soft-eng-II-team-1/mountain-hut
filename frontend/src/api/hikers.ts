import {request} from "./client";
import type {CreatedHiker, HikerQuery, HikerSummary, NewHiker} from "../types";

// MH-07: staff only. email is an exact match, name and phone also partial
export const searchHikers = (query: HikerQuery) => {
  const params = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v) as [string, string][],
  );
  return request<HikerSummary[]>(`/api/hikers?${params}`);
};

// MH-07: staff only. 409 if the email is already registered
export const createHiker = (data: NewHiker) =>
  request<CreatedHiker>("/api/hikers", "POST", data);
