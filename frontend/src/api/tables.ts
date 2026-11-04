import { ApiError } from "./auth";
import type { Table, TableInput } from "../types";

async function tableRequest<T>(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg = data?.error ?? data?.message ?? "Something went wrong";
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const getTables = () => tableRequest<Table[]>("/api/tables", "GET");

export const createTable = (data: TableInput) =>
  tableRequest<Table>("/api/tables", "POST", data);

export const updateTable = (tableId: string, data: TableInput) =>
  tableRequest<Table>(`/api/tables/${tableId}`, "PUT", data);

export const deleteTable = (tableId: string) =>
  tableRequest<void>(`/api/tables/${tableId}`, "DELETE");