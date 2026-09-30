import { apiRequest, tokenStore } from "./client";
import type { AuthResponse, RegisterPayload, Role, User } from "./types";

/** POST /auth/login  { email, password, role } → { token, user } */
export async function login(email: string, password: string, role: Role) {
  const res = await apiRequest<AuthResponse>("/auth/login", { method: "POST", body: { email, password, role } });
  tokenStore.set(res.token);
  return res.user;
}

/** POST /auth/register  RegisterPayload → { token, user } */
export async function register(payload: RegisterPayload) {
  const res = await apiRequest<AuthResponse>("/auth/register", { method: "POST", body: payload });
  tokenStore.set(res.token);
  return res.user;
}

/** GET /auth/me → User */
export function getCurrentUser() {
  return apiRequest<User>("/auth/me");
}

/** Clears the stored token (optionally call POST /auth/logout on your server). */
export async function logout() {
  try { await apiRequest("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
  tokenStore.clear();
}

/** Redirects to GET /auth/google if your Flask app implements Google OAuth. */
export function googleSignInUrl() {
  return `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"}/auth/google`;
}
