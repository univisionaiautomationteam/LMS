import type { AuthUser } from "../types";

/** Client-side hint for sidebar badge — mirrors server required fields loosely. */
export function isProfileIncomplete(user: AuthUser | null | undefined): boolean {
  if (!user || user.role === "admin") return false;
  const p = user.profile;
  if (user.role === "collegeAdmin") {
    return !String(p?.state ?? "").trim() || !String(p?.city ?? "").trim() || !String(p?.phone ?? "").trim();
  }
  return p?.complete !== true;
}
