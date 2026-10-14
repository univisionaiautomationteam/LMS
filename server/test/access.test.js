import test from "node:test";
import assert from "node:assert/strict";
import { courseAccessFor, courseScopeFilter, assetScopeFilter, canAccessCourse, canManageAsset, canManageCourse } from "../src/utils/access.js";
import { isSafeObjectKey } from "../src/services/storage.js";

const college = (overrides = {}) => ({
  _id: "college-1",
  active: true,
  departments: [
    { _id: "dept-cse", name: "Computer Science", active: true, allowedCourseIds: ["python", "cpp"] },
    { _id: "dept-ece", name: "Electronics", active: false, allowedCourseIds: ["embedded-systems"] },
  ],
  ...overrides,
});

const student = (overrides = {}) => ({
  role: "student",
  collegeId: "college-1",
  departmentId: "dept-cse",
  ...overrides,
});

test("staff roles are unrestricted", () => {
  assert.equal(courseAccessFor({ role: "admin" }, null).unrestricted, true);
  assert.equal(courseAccessFor({ role: "teacher" }, null).unrestricted, true);
  assert.equal(courseAccessFor({ role: "collegeAdmin", collegeId: "college-1" }, null).unrestricted, true);
});

test("access fails closed for missing, unassigned or inactive users", () => {
  assert.deepEqual(courseAccessFor(null, college()).slugs, []);
  assert.deepEqual(courseAccessFor(student({ collegeId: null }), college()).slugs, []);
  assert.deepEqual(courseAccessFor(student(), null).slugs, []);
  assert.deepEqual(courseAccessFor(student(), college({ active: false })).slugs, []);
  assert.deepEqual(courseAccessFor(student(), college({ departments: [] })).slugs, []);
  assert.deepEqual(courseAccessFor(student({ departmentId: "dept-missing" }), college()).slugs, []);
  // inactive department
  assert.deepEqual(courseAccessFor(student({ departmentId: "dept-ece" }), college()).slugs, []);
});

test("student is limited to their department's allowed courses", () => {
  const access = courseAccessFor(student(), college());
  assert.equal(access.unrestricted, false);
  assert.deepEqual([...access.slugs], ["python", "cpp"]);
  assert.equal(canAccessCourse(access, "python"), true);
  assert.equal(canAccessCourse(access, "java"), false);
});

test("department resolves by id or by case-insensitive name", () => {
  const byName = courseAccessFor(student({ departmentId: null, department: "  computer science " }), college());
  assert.deepEqual([...byName.slugs], ["python", "cpp"]);
});

test("a department with no allowed courses yields no visibility", () => {
  const empty = college({
    departments: [{ _id: "dept-cse", name: "Computer Science", active: true, allowedCourseIds: [] }],
  });
  assert.deepEqual([...courseAccessFor(student(), empty).slugs], []);
});

test("courseScopeFilter confines Mongo queries to the caller's courses", () => {
  assert.deepEqual(courseScopeFilter({ unrestricted: true, slugs: null }), {});
  assert.deepEqual(courseScopeFilter({ unrestricted: false, slugs: ["python"] }), { slug: { $in: ["python"] } });
  // A scoped filter must never degrade into an unfiltered query.
  assert.deepEqual(courseScopeFilter({ unrestricted: false, slugs: [] }), { slug: { $in: [] } });
});

test("assetScopeFilter matches on `course`, since Asset has no slug field", () => {
  assert.deepEqual(assetScopeFilter({ unrestricted: true, slugs: null }), {});
  assert.deepEqual(assetScopeFilter({ unrestricted: false, slugs: ["python", "cpp"] }), {
    course: { $in: ["python", "cpp"] },
  });
  assert.deepEqual(assetScopeFilter({ unrestricted: false, slugs: [] }), { course: { $in: [] } });
});

test("object keys outside the generated shape are rejected", () => {
  const good = "courses/python/video/1f3c9a7e-8b21-4d55-9c10-2ae4f6b8d913-intro.mp4";
  assert.equal(isSafeObjectKey(good), true);
  for (const bad of [
    "../../../etc/passwd",
    "courses/python/video/short-uuid.mp4",
    "courses/../admin/video/1f3c9a7e-8b21-4d55-9c10-2ae4f6b8d913-x.mp4",
    "courses/Python/video/1f3c9a7e-8b21-4d55-9c10-2ae4f6b8d913-x.mp4",
    "other/prefix/1f3c9a7e-8b21-4d55-9c10-2ae4f6b8d913-x.mp4",
    "courses/python/exec/1f3c9a7e-8b21-4d55-9c10-2ae4f6b8d913-x.sh",
    "",
    null,
  ]) {
    assert.equal(isSafeObjectKey(bad), false, `expected rejection for ${bad}`);
  }
});

test("teachers manage only their own uploads, admins manage all", () => {
  const asset = { createdBy: "teacher@taraslearn.com" };
  assert.equal(canManageAsset({ role: "admin", email: "a@b.com" }, asset), true);
  assert.equal(canManageAsset({ role: "teacher", email: "teacher@taraslearn.com" }, asset), true);
  assert.equal(canManageAsset({ role: "teacher", email: "other@taraslearn.com" }, asset), false);
  assert.equal(canManageAsset({ role: "student", email: "s@b.com" }, asset), false);
  assert.equal(canManageAsset(null, asset), false);
  assert.equal(canManageAsset({ role: "admin" }, null), false);
});

test("college admins manage only their own college's content", () => {
  const cadmin = { role: "collegeAdmin", collegeId: "college-1" };
  assert.equal(canManageCourse(cadmin, { collegeId: "college-1" }), true);
  assert.equal(canManageCourse(cadmin, { collegeId: "college-2" }), false);
  assert.equal(canManageCourse(cadmin, { collegeId: null }), false);
  assert.equal(canManageCourse(cadmin, {}), false);
  assert.equal(canManageAsset(cadmin, { collegeId: "college-1" }), true);
  assert.equal(canManageAsset(cadmin, { collegeId: "college-2" }), false);
  // A teacher still only manages their own course, regardless of college.
  assert.equal(canManageCourse({ role: "teacher", email: "t@x.com" }, { createdBy: "t@x.com", collegeId: "college-9" }), true);
});
