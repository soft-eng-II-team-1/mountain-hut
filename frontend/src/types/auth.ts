export type Role = "hiker" | "employee" | "warden";

// Hut staff. The warden can do everything an employee can (context.md)
export const STAFF_ROLES: Role[] = ["employee", "warden"];

// What the backend returns
export type User = {
  user_id: string;
  email: string;
  role: Role;
};

export type SignupData = {
  name: string;
  surname: string;
  email: string;
  phone?: string;
  password: string;
};
