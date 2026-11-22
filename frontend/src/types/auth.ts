export type Role = "hiker" | "employee" | "warden";

export const ALL_ROLES: Role[] = ["hiker", "employee", "warden"];

export const STAFF_ROLES: Role[] = ["employee", "warden"];

export type User = {
  user_id: string;
  email: string;
  role: Role;
  first_login?: boolean;
};

export type SignupData = {
  name: string;
  surname: string;
  email: string;
  phone?: string;
  notes?: string;
  emergency_contact?: string;
  password: string;
};
