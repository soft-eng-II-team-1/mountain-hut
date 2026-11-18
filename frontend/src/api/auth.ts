import type {SignupData, User} from "../types";
import {ApiError, request} from "./client";

export const login = (email: string, password: string) =>
  request<User>("/api/auth/login", "POST", {email, password});

export const signup = (data: SignupData) =>
  request<User>("/api/auth/signup", "POST", data);

export const logout = () => request<void>("/api/auth/logout", "POST", {});

// --- Passwords ---
// NOTE: these endpoints are not in the backend yet, the paths/bodies below are
// the contract the frontend expects. Adjust here if the backend picks other names.

// Logged-in user changes their password. current_password is omitted only for the
// forced update after a first login (MH-07), where the backend checks first_login instead.
export const changePassword = (new_password: string, current_password?: string) =>
  request<User>("/api/auth/password", "PUT", {current_password, new_password});

// Sends a one-time code to the email (should answer 200 even for unknown emails)
export const requestPasswordReset = (email: string) =>
  request<void>("/api/auth/password/forgot", "POST", {email});

// Checks the code without consuming it, so we can move on to the new-password step
export const verifyResetCode = (email: string, otp: string) =>
  request<void>("/api/auth/password/verify-otp", "POST", {email, otp});

// Sets the new password using the code received by email
export const resetPassword = (email: string, otp: string, new_password: string) =>
  request<void>("/api/auth/password/reset", "POST", {email, otp, new_password});

// Returns null when nobody is logged in instead of throwing
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    return await request<User>("/api/auth/user");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
};
