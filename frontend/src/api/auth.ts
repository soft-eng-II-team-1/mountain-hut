import type {SignupData, User} from "../types";
import {ApiError, request} from "./client";

export const login = (email: string, password: string) =>
  request<User>("/api/auth/login", "POST", {email, password});

export const signup = (data: SignupData) =>
  request<User>("/api/auth/signup", "POST", data);

export const logout = () => request<void>("/api/auth/logout", "POST", {});

// --- Passwords ---

// ApiError.code sent with the 401 of a wrong old password (an expired session is a 401 without it)
export const INVALID_OLD_PASSWORD = "INVALID_OLD_PASSWORD";

// Logged-in user changes their password; 401 if the old one is wrong.
// The forced update after a first login (MH-07) sends the temporary password as oldPassword
export const changePassword = (newPassword: string, oldPassword: string) =>
  request<void>("/api/auth/password", "PUT", {oldPassword, newPassword});

// Emails a one-time recovery code (valid 10 minutes). Answers 202 even for unknown emails
export const requestPasswordReset = (email: string) =>
  request<void>("/api/auth/password-reset/request", "POST", {email});

// Sets the new password with the emailed code; 400 if the code is wrong or expired
export const resetPassword = (email: string, recoveryCode: string, newPassword: string) =>
  request<void>("/api/auth/password-reset/confirm", "POST", {
    email,
    recoveryCode,
    newPassword,
  });

// Returns null when nobody is logged in instead of throwing
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    return await request<User>("/api/auth/user");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
};
