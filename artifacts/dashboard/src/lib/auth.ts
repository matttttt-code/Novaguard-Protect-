import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface TokenUser {
  userId: string;
  userTag: string;
  avatarURL: string;
  isOwner: boolean;
  guilds: Array<{ id: string; name: string; icon: string | null }>;
}

export function initAuth() {
  setAuthTokenGetter(() => localStorage.getItem("dash_token"));
}

export function setToken(token: string) {
  localStorage.setItem("dash_token", token);
}

export function clearToken() {
  localStorage.removeItem("dash_token");
}

export function getToken() {
  return localStorage.getItem("dash_token");
}

export function decodeToken(): TokenUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    return payload as TokenUser;
  } catch {
    return null;
  }
}
