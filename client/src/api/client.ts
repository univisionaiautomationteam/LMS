import type { Asset, AuthUser, College, Course, CourseModule, CourseProgress, Language, ProgressSummary, QuizQuestion, QuizResult, TeacherStats, UploadTicket, UserRole, WeeklyGoal } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const TOKEN_KEY = "lms-token";

/** Fired when the API rejects our token so the app can drop to the sign-in screen. */
export const UNAUTHORIZED_EVENT = "lms:unauthorized";

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
    // A rejected sign-in is not an expired session, so it must not clear the token.
    const isAuthAttempt = path.startsWith("/auth/login") || path.startsWith("/auth/register");
    if (response.status === 401 && !isAuthAttempt) {
      setToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
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
  listMyCourses: () => request<{ courses: Course[] }>("/courses/mine"),
  createCourse: (values: Record<string, unknown>) =>
    request<{ course: Course }>("/courses", { method: "POST", body: JSON.stringify(values) }),
  updateCourse: (id: string, values: Record<string, unknown>) =>
    request<{ course: Course }>(`/courses/${id}`, { method: "PUT", body: JSON.stringify(values) }),
  saveCurriculum: (id: string, modules: CourseModule[]) =>
    request<{ course: Course }>(`/courses/${id}/curriculum`, { method: "PUT", body: JSON.stringify({ modules }) }),
  deleteCourse: (id: string) => request<{ ok: boolean }>(`/courses/${id}`, { method: "DELETE" }),
  teacherStats: () => request<TeacherStats>("/teacher/stats"),

  getProgress: () => request<{ progress: CourseProgress[]; summary: ProgressSummary }>("/progress"),
  setLessonProgress: (courseId: string, lessonId: string, completed: boolean) =>
    request<{ ok: boolean; completed: boolean }>(`/progress/${courseId}/${lessonId}`, {
      method: "PUT",
      body: JSON.stringify({ completed }),
    }),
  getQuiz: (courseId: string, lessonKey?: string) =>
    request<{ quiz: { lessonKey: string; title: string; total: number; passScore: number; questions: QuizQuestion[] } }>(
      `/progress/${courseId}/quiz${lessonKey ? `/${lessonKey}` : ""}`
    ),
  submitQuiz: (courseId: string, answers: number[], lessonKey?: string) =>
    request<QuizResult>(`/progress/${courseId}/quiz${lessonKey ? `/${lessonKey}` : ""}`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),

  listUsers: () => request<{ users: AuthUser[] }>("/users"),
  createUser: (values: Record<string, unknown>) =>
    request<{ user: AuthUser }>("/users", { method: "POST", body: JSON.stringify(values) }),
  createUsersBulk: (rows: Record<string, unknown>[], defaultPassword?: string) =>
    request<{ created: number; updated: number; rejected: { email: string; reason: string }[] }>("/users/bulk", {
      method: "POST",
      body: JSON.stringify({ rows, defaultPassword }),
    }),
  deleteUser: (id: string) => request<{ ok: boolean }>(`/users/${id}`, { method: "DELETE" }),
  assignUserDepartment: (id: string, values: { departmentId: string; department: string }) =>
    request<{ user: AuthUser }>(`/users/${id}/department`, { method: "PUT", body: JSON.stringify(values) }),
  // A password change invalidates the caller's own token, so the server returns a
  // replacement. Applying it here means no caller can forget to and get signed out.
  async updateProfile(values: Record<string, unknown>) {
    const data = await request<{ user: AuthUser; token?: string }>("/users/profile", {
      method: "PUT",
      body: JSON.stringify(values),
    });
    if (data.token) setToken(data.token);
    return data;
  },
  getWeeklyGoal: () => request<{ goal: WeeklyGoal }>("/users/weekly-goal"),
  updateWeeklyGoal: (values: { targetMinutes?: number; completedMinutes?: number }) =>
    request<{ goal: WeeklyGoal }>("/users/weekly-goal", { method: "PUT", body: JSON.stringify(values) }),

  listColleges: () => request<{ colleges: College[] }>("/colleges"),
  createCollege: (values: Record<string, unknown>) =>
    request<{ college: College; admin: AuthUser | null }>("/colleges", { method: "POST", body: JSON.stringify(values) }),
  updateCollege: (id: string, values: Record<string, unknown>) =>
    request<{ college: College }>(`/colleges/${id}`, { method: "PUT", body: JSON.stringify(values) }),
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
  createUploadTicket: (values: Record<string, unknown>) =>
    request<UploadTicket>("/assets/upload-ticket", { method: "POST", body: JSON.stringify(values) }),
  assetUrl: (id: string) => request<{ url: string; expiresIn: number }>(`/assets/url/${id}`),

  runCode: (language: Language, code: string, stdin: string) =>
    request<{ output: string; mode: string; status: string; durationMs: number; time?: string; memory?: number }>(
      "/run",
      { method: "POST", body: JSON.stringify({ language, code, stdin }) }
    ),

  deleteCollege: (id: string) => request<{ ok: boolean }>(`/colleges/${id}`, { method: "DELETE" }),

  dashboard: () =>
    request<{ students: number; teachers: number; courses: number; assets: number; mapped: number }>("/dashboard"),
};

/**
 * Sends the file bytes straight to storage using the ticket the server issued.
 *
 * An S3 presigned POST carries its authorisation in the form fields, so no
 * bearer token is attached. The local fallback proxies through the API instead
 * and therefore does need the token.
 */
export async function uploadFile(ticket: UploadTicket, file: File, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (ticket.mode === "s3") {
      const body = new FormData();
      for (const [key, value] of Object.entries(ticket.fields ?? {})) body.append(key, value);
      body.append("file", file);

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.open("POST", ticket.uploadUrl, true);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Storage rejected the upload (${xhr.status}).`));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed: network error."));
      xhr.ontimeout = () => reject(new Error("Upload timed out."));
      xhr.send(body);
      return;
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.open("PUT", ticket.uploadUrl, true);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    const token = getToken();
    if (token) xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));
    xhr.send(file);
  });
}

export function roleLabel(role: UserRole): string {
  return role === "admin"
    ? "Super admin"
    : role === "collegeAdmin"
    ? "College admin"
    : role === "teacher"
    ? "Teacher"
    : "Student";
}

/** Human-readable "who posted this course" for the catalog and admin lists. */
export function courseAuthorLabel(course: { createdByRole?: string }): string {
  return course.createdByRole === "teacher"
    ? "Faculty"
    : course.createdByRole === "collegeAdmin"
    ? "College admin"
    : course.createdByRole === "admin"
    ? "Platform admin"
    : "Platform";
}
