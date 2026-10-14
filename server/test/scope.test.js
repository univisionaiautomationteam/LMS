import test from "node:test";
import assert from "node:assert/strict";
import { isSuperAdmin, isCollegeAdmin, collegeScope, scopeToCollege, canAdminCollege, collegeVisibilityFilter } from "../src/utils/scope.js";
import { profileRole, profileDetailBucket, isAdminRole } from "../src/utils/helpers.js";

const superAdmin = { role: "admin", collegeId: null };
const collegeAdmin = { role: "collegeAdmin", collegeId: "college-1" };
const teacher = { role: "teacher", collegeId: "college-1" };
const student = { role: "student", collegeId: "college-2" };

test("super admin is the only unscoped role", () => {
  assert.equal(isSuperAdmin(superAdmin), true);
  assert.equal(isSuperAdmin(collegeAdmin), false);
  assert.equal(collegeScope(superAdmin), null);
  assert.deepEqual(scopeToCollege(superAdmin), {});
});

test("college admin and everyone else are pinned to their own college", () => {
  assert.equal(collegeScope(collegeAdmin), "college-1");
  assert.deepEqual(scopeToCollege(collegeAdmin), { collegeId: "college-1" });
  assert.deepEqual(scopeToCollege(teacher), { collegeId: "college-1" });
  assert.deepEqual(scopeToCollege(student), { collegeId: "college-2" });
  assert.deepEqual(scopeToCollege(teacher, "course"), { course: "college-1" });
});

test("an unassigned non-super account fails closed", () => {
  const orphan = { role: "teacher", collegeId: null };
  assert.equal(collegeScope(orphan), null);
  assert.deepEqual(scopeToCollege(orphan), { collegeId: { $in: [] } });
});

test("only the super admin or the college's own admin may administer it", () => {
  assert.equal(canAdminCollege(superAdmin, "college-9"), true);
  assert.equal(canAdminCollege(collegeAdmin, "college-1"), true);
  assert.equal(canAdminCollege(collegeAdmin, "college-2"), false);
  assert.equal(canAdminCollege(teacher, "college-1"), false);
  assert.equal(canAdminCollege(student, "college-2"), false);
  assert.equal(canAdminCollege({ role: "collegeAdmin", collegeId: null }, "college-1"), false);
});

test("college admin shares the admin (empty) profile detail list", () => {
  assert.equal(isCollegeAdmin(collegeAdmin), true);
  assert.equal(isAdminRole("collegeAdmin"), true);
  assert.equal(isAdminRole("admin"), true);
  assert.equal(isAdminRole("teacher"), false);
  assert.equal(profileRole("collegeAdmin"), "admin");
  assert.equal(profileDetailBucket("collegeAdmin"), "");
});

test("college visibility keeps platform content visible and fails closed", () => {
  // Super admin sees everything.
  assert.deepEqual(collegeVisibilityFilter(superAdmin), {});
  // Own college + platform (null) content.
  assert.deepEqual(collegeVisibilityFilter(collegeAdmin), {
    $or: [{ collegeId: "college-1" }, { collegeId: null }],
  });
  assert.deepEqual(collegeVisibilityFilter(student, "course"), {
    $or: [{ course: "college-2" }, { course: null }],
  });
  // An unassigned non-super account can never match.
  assert.deepEqual(collegeVisibilityFilter({ role: "teacher", collegeId: null }), {
    collegeId: { $in: [] },
  });
});
