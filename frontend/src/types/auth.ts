export type Role = "hiker" | "employee" | "warden";

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
