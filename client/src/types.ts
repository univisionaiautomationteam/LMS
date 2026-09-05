export type Language = "python" | "c" | "cpp" | "java";
export type View = "home" | "catalog" | "course" | "practice" | "admin" | "profile";
export type UserRole = "admin" | "teacher" | "student";

export type UserProfile = {
  collegeName: string;
  department: string;
  degree: string;
  studyYear: string;
  state: string;
  city: string;
  pincode: string;
  phone: string;
  about: string;
  photoUrl: string;
  resumeUrl: string;
  resumeName: string;
  complete: boolean;
};

export type AuthUser = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  mustChangePassword?: boolean;
  studentId?: string;
  department?: string;
  departmentId?: string;
  collegeId?: string;
  collegeName?: string;
  collegeNameLocked?: boolean;
  profile?: UserProfile;
};

export type Course = {
  _id?: string;
  slug: string;
  title: string;
  language: string;
  category: string;
  icon: string;
  color: string;
  level: string;
  lessons: number;
  duration: string;
  description: string;
  progress?: number;
};

export type Asset = {
  _id: string;
  title: string;
  kind: "video" | "document";
  course: string;
  mimeType: string;
  size: number;
  url: string;
};

export type CollegeDepartment = {
  _id: string;
  name: string;
  code: string;
  active: boolean;
  allowedCourseIds: string[];
};

export type College = {
  _id: string;
  name: string;
  code: string;
  state: string;
  active: boolean;
  allowedCourseIds: string[];
  departments: CollegeDepartment[];
};

export type RunMeta = {
  status: string;
  mode: string;
  durationMs: number;
  time?: string | null;
  memory?: number | null;
  exitCode?: number | null;
};

export type AssistantMessage = { id: string; role: "assistant" | "user"; text: string };
