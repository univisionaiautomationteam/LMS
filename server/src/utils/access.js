import { College } from "../models/College.js";
import { Course } from "../models/Course.js";
import { User } from "../models/User.js";

const EMPTY = Object.freeze({ unrestricted: false, slugs: Object.freeze([]) });
const UNRESTRICTED = Object.freeze({ unrestricted: true, slugs: null });

/** Finds the college department a student belongs to, by id first then by name. */
function resolveDepartment(user, college) {
  if (!user || !college) return null;
  return (
    (college.departments ?? []).find((dept) => {
      const byId = user.departmentId && String(dept._id) === String(user.departmentId);
      const byName =
        user.department && String(dept.name).trim().toLowerCase() === String(user.department).trim().toLowerCase();
      return Boolean(byId || byName);
    }) ?? null
  );
}

/**
 * Pure decision: which course slugs may this user read, given their college.
 *
 * Admin and teacher are unrestricted. A student is limited to the courses their
 * department is permitted to access, and only while both the college and the
 * department are active. Anything unresolved resolves to "no access" so a
 * malformed, inactive or unassigned account fails closed.
 */
export function courseAccessFor(user, college) {
  if (!user) return EMPTY;
  if (user.role === "admin" || user.role === "collegeAdmin" || user.role === "teacher") return UNRESTRICTED;
  if (!user.collegeId) return EMPTY;
  if (!college || !college.active) return EMPTY;

  const department = resolveDepartment(user, college);
  if (!department || !department.active) return EMPTY;
  return { unrestricted: false, slugs: Object.freeze([...(department.allowedCourseIds ?? [])]) };
}

/**
 * Loads the caller's college, then applies the pure access decision.
 *
 * A student additionally inherits every course published by teachers of their
 * own department: a faculty upload is part of the department that teaches it,
 * so students see it without an admin having to tick it on the access grid.
 */
export async function resolveCourseAccess(user) {
  if (!user || user.role === "admin" || user.role === "collegeAdmin" || user.role === "teacher" || !user.collegeId) {
    return courseAccessFor(user, null);
  }
  const college = await College.findById(user.collegeId).select("active departments").lean();
  const access = courseAccessFor(user, college);
  if (access.unrestricted) return access;

  const department = resolveDepartment(user, college);
  // Anything unresolved, inactive or unassigned already fails closed above.
  if (!college?.active || !department || !department.active) return access;

  const faculty = await User.find({
    collegeId: user.collegeId,
    role: "teacher",
    $or: [{ departmentId: department._id }, { department: department.name }],
  })
    .select("email")
    .lean();
  const emails = faculty.map((teacher) => teacher.email).filter(Boolean);
  if (!emails.length) return access;

  const facultyCourses = await Course.find({ createdBy: { $in: emails } }).select("slug").lean();
  const slugs = new Set(access.slugs);
  for (const course of facultyCourses) slugs.add(course.slug);
  return { unrestricted: false, slugs: Object.freeze([...slugs]) };
}

/** Mongo filter that keeps a query inside the caller's course scope. */
export function courseScopeFilter(access) {
  if (access.unrestricted) return {};
  return { slug: { $in: [...access.slugs] } };
}

/** Assets carry the course slug in `course`, not `slug`, so they need their own filter. */
export function assetScopeFilter(access) {
  if (access.unrestricted) return {};
  return { course: { $in: [...access.slugs] } };
}

export function canAccessCourse(access, slug) {
  if (access.unrestricted) return true;
  return access.slugs.includes(String(slug ?? ""));
}

/** Admins manage all content; teachers manage only what they uploaded. */
export function canManageAsset(user, asset) {
  if (!user || !asset) return false;
  if (user.role === "admin") return true;
  if (user.role === "teacher") return asset.createdBy === user.email;
  if (user.role === "collegeAdmin") {
    return Boolean(asset.collegeId) && String(asset.collegeId) === String(user.collegeId ?? "");
  }
  return false;
}

/** Admins manage every course; teachers manage only the courses they created. */
export function canManageCourse(user, course) {
  if (!user || !course) return false;
  if (user.role === "admin") return true;
  if (user.role === "teacher") return Boolean(course.createdBy) && course.createdBy === user.email;
  // A college admin governs the courses that belong to their own college, but
  // never platform-wide (`null`) or another college's courses.
  if (user.role === "collegeAdmin") {
    return Boolean(course.collegeId) && String(course.collegeId) === String(user.collegeId ?? "");
  }
  return false;
}

/**
 * Course visibility for a teacher's unique portal: their own courses plus
 * platform courses (admin-owned or legacy), never another teacher's courses.
 * `createdByRole: { $ne: "teacher" }` also matches missing fields, so seed and
 * legacy courses stay visible while remaining admin-owned.
 */
export function teacherCourseFilter(email) {
  return { $or: [{ createdBy: email }, { createdByRole: { $ne: "teacher" } }] };
}
