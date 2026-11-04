import type {SignupData, User} from "../types";
import {ApiError, request} from "./client";

export const login = (email: string, password: string) =>
  request<User>("/api/auth/login", "POST", {email, password});

export const signup = (data: SignupData) =>
  request<User>("/api/auth/signup", "POST", data);

export const logout = () => request<void>("/api/auth/logout", "POST", {});

// Returns null when nobody is logged in instead of throwing
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    return await request<User>("/api/auth/user");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
};
