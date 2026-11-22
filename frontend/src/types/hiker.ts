import type {User} from "./auth";

// GET /api/hikers: a registered hiker found by the staff (MH-07)
export type HikerSummary = {
  user_id: string;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
};

// Search criteria of GET /api/hikers, the given ones are combined in AND
export type HikerQuery = {name?: string; email?: string; phone?: string};

// Body of POST /api/hikers: a complete account created by the staff
export type NewHiker = {
  name: string;
  surname: string;
  email: string;
  phone?: string;
  emergency_contact?: string;
  notes?: string;
};

// POST /api/hikers answers with the account and the password to tell the hiker
export type CreatedHiker = User & {generated_password: string};
