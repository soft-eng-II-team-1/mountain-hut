import type {Profile, ProfileUpdate} from "../types";
import {request} from "./client";

// NOTE: not in the backend yet

export const getProfile = () => request<Profile>("/api/profile");

export const updateProfile = (data: ProfileUpdate) =>
  request<Profile>("/api/profile", "PUT", data);
