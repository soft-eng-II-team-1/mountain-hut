export type User = {
  id: number;
  name: string;
  surname: string;
  email: string;
  phone?: string | null;
  role?: string;
};

export type SignupData = {
  name: string;
  surname: string;
  email: string;
  phone?: string;
  password: string;
};

async function request<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {"Content-Type": "application/json"},
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Something went wrong");
  }

  return res.json().catch(() => undefined);
}

export const login = (email: string, password: string) => request<User>("/api/auth/login", {email, password});

export const signup = (data: SignupData) => request<User>("/api/auth/signup", data);

export const logout = () => request<void>("/api/auth/logout", {});
