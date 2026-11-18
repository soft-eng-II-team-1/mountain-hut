import {create} from "zustand";
import * as authApi from "../api/auth";
import type {SignupData, User} from "../types";

type AuthState = {
  user: User | null;
  // true until the first /api/auth/user check has finished
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: SignupData) => Promise<User>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
};

let initStarted = false;

// The session itself lives in the backend cookie; this only mirrors who is logged in
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  loading: true,

  init: async () => {
    // StrictMode runs effects twice in dev, only ask the backend once
    if (initStarted) return;
    initStarted = true;
    try {
      set({user: await authApi.getCurrentUser()});
    } catch {
      set({user: null});
    } finally {
      set({loading: false});
    }
  },

  login: async (email, password) => {
    const user = await authApi.login(email, password);
    set({user});
    return user;
  },

  signup: async (data) => {
    const user = await authApi.signup(data);
    set({user});
    return user;
  },

  changePassword: async (newPassword, currentPassword) => {
    const updated = await authApi.changePassword(newPassword, currentPassword);
    // keep what we had if the backend answers without a body, the flag is cleared either way
    set((s) => ({
      user: updated ?? (s.user && {...s.user, first_login: false}),
    }));
  },

  logout: async () => {
    await authApi.logout();
    set({user: null});
  },
}));
