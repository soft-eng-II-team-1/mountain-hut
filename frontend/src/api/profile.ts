import type {Profile, ProfileUpdate} from "../types";
import {request} from "./client";

// NOTE: not in the backend yet (the session only holds id, email and role).
// These are the paths/bodies the frontend expects; adjust here if the backend differs.

export const getProfile = () => request<Profile>("/api/profile");

export const updateProfile = (data: ProfileUpdate) =>
  request<Profile>("/api/profile", "PUT", data);
