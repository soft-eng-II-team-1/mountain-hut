import type {SignupData, User} from "../types";

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

async function request<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {"Content-Type": "application/json"},
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, readError(res.status, data));
  }

  // logout answers 200 with no body
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const login = (email: string, password: string) =>
  request<User>("/api/auth/login", {email, password});

export const signup = (data: SignupData) =>
  request<User>("/api/auth/signup", data);

export const logout = () => request<void>("/api/auth/logout", {});

// Returns null when nobody is logged in instead of throwing
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    return await request<User>("/api/auth/user");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
};
