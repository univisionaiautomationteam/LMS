export type Language = "python" | "c" | "cpp" | "java";
export type View =
  | "home"
  | "catalog"
  | "course"
  | "practice"
  | "admin"
  | "profile"
  | "teacher"
  | "teacherCourses";
export type UserRole = "admin" | "collegeAdmin" | "teacher" | "student";

export type StudentProfileDetails = {
  degree: string;
  studyYear: string;
  guardianName: string;
  guardianPhone: string;
  courseType: string;
};

export type TeacherProfileDetails = {
  designation: string;
  qualification: string;
  specialization: string;
  experienceYears: string;
};

export type UserProfile = {
  collegeName: string;
  department: string;
  state: string;
  city: string;
  pincode: string;
  phone: string;
  about: string;
  photoUrl: string;
  resumeUrl: string;
  resumeName: string;
  complete: boolean;
  student?: StudentProfileDetails;
  teacher?: TeacherProfileDetails;
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
  collegeNameLocked?: boolean;
  profile?: UserProfile;
};

export type Lesson = {
  key: string;
  title: string;
  type: "video" | "code" | "quiz" | "document";
  duration: string;
  /** The lesson's own file, linked by the teacher's curriculum builder. */
  assetId?: string | null;
  /** Present only on `quiz` lessons authored by the teacher. */
  quiz?: LessonQuiz | null;
  moduleId?: string;
  moduleTitle?: string;
  moduleOrder?: number;
  order?: number;
};

export type CourseModule = {
  moduleId: string;
  title: string;
  order: number;
  lessons: Lesson[];
};

export type LessonQuizQuestion = { prompt: string; options: string[]; answer: number };

export type LessonQuiz = {
  title: string;
  passScore: number;
  questions: LessonQuizQuestion[];
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
  curriculum?: Lesson[];
  modules?: CourseModule[];
  createdBy?: string;
  createdByRole?: string;
  lastUpdatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CourseProgress = {
  courseId: string;
  completedLessons: string[];
  total: number;
  percent: number;
  quiz: { score: number; total: number; percent: number } | null;
};

export type ProgressSummary = {
  lessonsCompleted: number;
  quizzesPassed: number;
  averageScore: number;
  activityDates: string[];
};

export type QuizQuestion = { prompt: string; options: string[] };

export type QuizReviewItem = { prompt: string; options: string[]; correctIndex: number; chosen: number };

export type QuizResult = {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  passScore: number;
  lessonKey?: string;
  review: QuizReviewItem[];
};

export type WeeklyGoal = {
  targetMinutes: number;
  completedMinutes: number;
  weekKey: string;
};

export type TeacherStats = {
  coursesCreated: number;
  coursesUpdated: number;
  coursesTotal: number;
  lessonsTotal: number;
  assetsUploaded: number;
  coursesCovered: number;
  storageBytes: number;
  profileComplete: boolean;
  recentCourses: { slug: string; title: string; icon: string; color: string; lessons: number; updatedAt: string }[];
};

export type Asset = {
  _id: string;
  title: string;
  kind: "video" | "document";
  course: string;
  lessonKey?: string;
  mimeType: string;
  size: number;
  url: string;
  objectKey?: string;
  createdBy?: string;
};

export type UploadTicket = {
  mode: "s3" | "local";
  objectKey: string;
  uploadUrl: string;
  fields: Record<string, string>;
  assetUrl: string;
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
  domains: string[];
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
