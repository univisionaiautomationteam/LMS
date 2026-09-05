import type { Asset, AuthUser, College, Course, Language, UserRole } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const TOKEN_KEY = "lms-token";

class ApiError extends Error {}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // ignore non-JSON responses
  }
  if (!response.ok) {
    throw new ApiError(data?.error ?? "Request failed.");
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: AuthUser; token: string; status?: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: AuthUser }>("/auth/me"),
  completePassword: (password: string) =>
    request<{ user: AuthUser; token: string }>("/auth/complete-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  listCourses: () => request<{ courses: Course[] }>("/courses"),
  createCourse: (values: Record<string, unknown>) =>
    request<{ course: Course }>("/courses", { method: "POST", body: JSON.stringify(values) }),
  updateCourse: (id: string, values: Record<string, unknown>) =>
    request<{ course: Course }>(`/courses/${id}`, { method: "PUT", body: JSON.stringify(values) }),
  deleteCourse: (id: string) => request<{ ok: boolean }>(`/courses/${id}`, { method: "DELETE" }),

  listUsers: () => request<{ users: AuthUser[] }>("/users"),
  createUser: (values: Record<string, unknown>) =>
    request<{ user: AuthUser }>("/users", { method: "POST", body: JSON.stringify(values) }),
  createUsersBulk: (rows: Record<string, unknown>[]) =>
    request<{ created: number; rejected: { email: string; reason: string }[] }>("/users/bulk", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
  deleteUser: (id: string) => request<{ ok: boolean }>(`/users/${id}`, { method: "DELETE" }),
  updateProfile: (values: Record<string, unknown>) =>
    request<{ user: AuthUser }>("/users/profile", { method: "PUT", body: JSON.stringify(values) }),

  listColleges: () => request<{ colleges: College[] }>("/colleges"),
  createCollege: (values: Record<string, unknown>) =>
    request<{ college: College }>("/colleges", { method: "POST", body: JSON.stringify(values) }),
  createCollegeDepartment: (id: string, values: Record<string, unknown>) =>
    request<{ college: College }>(`/colleges/${id}/departments`, { method: "POST", body: JSON.stringify(values) }),
  updateDepartmentAccess: (id: string, departmentId: string, values: Record<string, unknown>) =>
    request<{ college: College }>(`/colleges/${id}/departments/${departmentId}/access`, {
      method: "PUT",
      body: JSON.stringify(values),
    }),

  listAssets: () => request<{ assets: Asset[] }>("/assets"),
  createAsset: (values: Record<string, unknown>) =>
    request<{ asset: Asset }>("/assets", { method: "POST", body: JSON.stringify(values) }),
  updateAsset: (id: string, values: Record<string, unknown>) =>
    request<{ asset: Asset }>(`/assets/${id}`, { method: "PUT", body: JSON.stringify(values) }),
  deleteAsset: (id: string) => request<{ ok: boolean }>(`/assets/${id}`, { method: "DELETE" }),

  runCode: (language: Language, code: string, stdin: string) =>
    request<{ output: string; mode: string; status: string; durationMs: number; time?: string; memory?: number }>(
      "/run",
      { method: "POST", body: JSON.stringify({ language, code, stdin }) }
    ),

  dashboard: () =>
    request<{ students: number; teachers: number; courses: number; assets: number; mapped: number }>("/dashboard"),
};

export function roleLabel(role: UserRole): string {
  return role === "admin" ? "Administrator" : role === "teacher" ? "Teacher" : "Student";
}
