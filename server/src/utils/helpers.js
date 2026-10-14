export const PASSWORD_MIN = 10;

export function validateEmail(email) {
  return /^\S+@\S+\.\S+$/.test(String(email ?? "").trim());
}

/** Allows only absolute http(s) URLs so stored links cannot carry a `javascript:` payload. */
export function safeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? raw : "";
  } catch {
    return "";
  }
}

export function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** ISO-8601 week key ("2026-W41") so a stored weekly goal knows when to reset. */
export function weekKeyFor(date = new Date()) {
  const day = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Weekly goal bounds: a target or log beyond a whole week is a data error, not ambition. */
export const WEEK_MINUTES_MAX = 7 * 24 * 60;

export function clampWeekMinutes(value, fallback = 0) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(WEEK_MINUTES_MAX, Math.max(0, parsed));
}

/**
 * Profile fields are declared once here so validation and the save path can
 * never drift apart. A role's allowlist is the authoritative set: anything
 * outside it is dropped rather than stored, so one role can never write another
 * role's fields by posting them.
 */
const SHARED_PROFILE_FIELDS = [
  "collegeName",
  "department",
  "state",
  "city",
  "pincode",
  "phone",
  "about",
  "photoUrl",
  "resumeUrl",
  "resumeName",
];

const ROLE_PROFILE_FIELDS = {
  admin: [],
  teacher: ["designation", "qualification", "specialization", "experienceYears"],
  student: ["degree", "studyYear", "guardianName", "guardianPhone", "courseType"],
};

const REQUIRED_SHARED_FIELDS = ["collegeName", "department", "state", "city", "phone"];

const REQUIRED_ROLE_FIELDS = {
  admin: [],
  teacher: ["designation", "qualification"],
  student: ["degree", "studyYear"],
};

/** `photoUrl` joins REQUIRED_SHARED_FIELDS in Phase 4, once uploads exist. Until
 *  then requiring it would reject every save with nothing the user can fix. */

const FIELD_LABELS = {
  collegeName: "college name",
  department: "department",
  state: "state",
  city: "city",
  pincode: "PIN code",
  phone: "phone number",
  about: "about",
  photoUrl: "profile photo",
  resumeUrl: "resume",
  resumeName: "resume",
  degree: "degree",
  studyYear: "year of study",
  guardianName: "guardian name",
  guardianPhone: "guardian phone",
  courseType: "course type",
  designation: "designation",
  qualification: "qualification",
  specialization: "specialization",
  experienceYears: "years of experience",
};

/** Platform and college administrators share the same (empty) role-detail list. */
export function isAdminRole(role) {
  return role === "admin" || role === "collegeAdmin";
}

export function profileRole(role) {
  if (role === "teacher") return "teacher";
  return isAdminRole(role) ? "admin" : "student";
}

/** Every field this role is allowed to write. */
export function profileFieldsFor(role) {
  return [...SHARED_PROFILE_FIELDS, ...ROLE_PROFILE_FIELDS[profileRole(role)]];
}

/** Sub-document the role's own details live in; "" means the shared profile. */
export function profileDetailBucket(role) {
  const key = profileRole(role);
  return key === "teacher" ? "teacher" : key === "student" ? "student" : "";
}

export function requiredProfileFields(role) {
  return [...REQUIRED_SHARED_FIELDS, ...REQUIRED_ROLE_FIELDS[profileRole(role)]];
}

export function missingProfileField(values, role) {
  return (
    requiredProfileFields(role).find((key) => !String(values[key] ?? "").trim()) ?? null
  );
}

export function profileFieldLabel(key) {
  return FIELD_LABELS[key] ?? key;
}

/** `complete` is derived, never posted, so it can only be true when every
 *  required field for that role is actually filled in. */
export function isProfileComplete(values, role) {
  return missingProfileField(values, role) === null;
}

export function normalizeProfile(values, role) {
  return {
    values,
    missing: missingProfileField(values, role),
    required: requiredProfileFields(role),
  };
}

/**
 * Builds the stored `profile` sub-document for a role.
 *
 * Pure, so it is testable without a database. Fields outside the role's
 * allowlist are dropped even when posted, the role's own details land in their
 * bucket and the other role's bucket is cleared, and `complete` is derived from
 * the merged result rather than trusted from the request.
 *
 * A posted field wins even when blank, so a user can clear a value; an absent
 * field leaves the stored one alone.
 */
export function buildProfile(values = {}, current = {}, role = "student", lockedCollege = "") {
  const bucket = profileDetailBucket(role);
  const allowed = new Set(profileFieldsFor(role));

  // The stored profile keeps role details in a nested bucket, so it has to be
  // flattened before it can act as the merge base for flat request values.
  const merged = { ...current, ...(bucket ? (current[bucket] ?? {}) : {}) };
  for (const key of allowed) {
    if (key in values) merged[key] = String(values[key] ?? "").trim();
  }
  merged.collegeName = lockedCollege || String(merged.collegeName ?? "").trim();

  const shared = {};
  for (const key of SHARED_PROFILE_FIELDS) shared[key] = String(merged[key] ?? "").trim();
  shared.photoUrl = safeUrl(shared.photoUrl);
  shared.resumeUrl = safeUrl(shared.resumeUrl);

  const details = {};
  for (const key of ROLE_PROFILE_FIELDS[profileRole(role)]) {
    details[key] = String(merged[key] ?? "").trim();
  }

  const flat = { ...shared, ...details };
  const missing = missingProfileField(flat, role);

  return {
    profile: {
      ...shared,
      complete: missing === null,
      student: bucket === "student" ? details : {},
      teacher: bucket === "teacher" ? details : {},
    },
    missing,
  };
}

/**
 * Logs the real failure server-side and returns an opaque message.
 *
 * Driver and Mongoose errors leak collection names, schema paths and sometimes
 * connection strings, so they must never reach the client. Validation failures
 * are thrown as plain `ClientError` and pass their message through untouched.
 */
export function serverError(res, error, context) {
  console.error(`[${context}]`, error);
  if (res.headersSent) return;
  if (error instanceof ClientError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: "Something went wrong. Please try again." });
}

export class ClientError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ClientError";
    this.status = status;
  }
}
