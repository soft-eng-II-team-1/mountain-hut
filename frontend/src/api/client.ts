export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// backend sends {error} from routes and {message} from the auth guards.
// 422 are one long markdown string
function readError(
  status: number,
  data: {error?: string; message?: string} | null,
): string {
  const raw = data?.error ?? data?.message;
  if (!raw) return "Something went wrong";
  if (status === 422) {
    const reasons = [...raw.matchAll(/Reason: \*(.+?)\*/g)].map((m) => m[1]);
    if (reasons.length) return reasons.join(". ");
  }
  return raw;
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

export async function request<T>(
  url: string,
  method: Method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {"Content-Type": "application/json"},
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, readError(res.status, data));
  }

  // logout and deletes answer with no body
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
