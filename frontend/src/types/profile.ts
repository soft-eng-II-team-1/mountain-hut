import type {Role} from "./auth";

// Full details of the logged-in user, shown on the profile page
export type Profile = {
  user_id: string;
  role: Role;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
};

// Fields the user can edit themselves. The email is the login, so it stays fixed.
export type ProfileUpdate = {
  name: string;
  surname: string;
  phone?: string;
};
