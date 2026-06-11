import { getAuthenticatedHeaders } from "./api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export function createProfilePayload(user) {
  return {
    id: user?.id,
    email: user?.email,
    role: "user",
  };
}

export async function ensureUserProfile(user) {
  if (!user) return null;

  const response = await fetch(`${API_BASE_URL}/api/v1/profile`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(await getAuthenticatedHeaders()),
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Gagal mengambil profile: ${response.status}`);
  }

  const profile = await response.json();

  return {
    id: profile.id || user.id,
    email: profile.email || user.email,
    fullName: profile.fullName || "Authenticated User",
    role: profile.role || "user",
    avatarInitials: profile.avatarInitials || "RO",
    workspace: profile.workspace || "BLACK FLASH ORBIT",
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function insertRegisteredUserProfile(user) {
  return createProfilePayload(user);
}
