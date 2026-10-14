import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProfile,
  profileFieldsFor,
  profileDetailBucket,
  requiredProfileFields,
  missingProfileField,
  isProfileComplete,
  profileFieldLabel,
} from "../src/utils/helpers.js";

const studentPayload = {
  collegeName: "Anna University",
  department: "Computer Science",
  state: "Tamil Nadu",
  city: "Chennai",
  phone: "9876543210",
  degree: "B.Tech",
  studyYear: "3rd Year",
};

const teacherPayload = {
  collegeName: "Anna University",
  department: "Computer Science",
  state: "Tamil Nadu",
  city: "Chennai",
  phone: "9876543210",
  designation: "Associate Professor",
  qualification: "Ph.D",
};

test("each role gets its own allowlist and detail bucket", () => {
  assert.equal(profileDetailBucket("student"), "student");
  assert.equal(profileDetailBucket("teacher"), "teacher");
  assert.equal(profileDetailBucket("admin"), "");

  assert.ok(profileFieldsFor("student").includes("degree"));
  assert.ok(!profileFieldsFor("student").includes("designation"));
  assert.ok(profileFieldsFor("teacher").includes("designation"));
  assert.ok(!profileFieldsFor("teacher").includes("degree"));
});

test("required fields differ per role", () => {
  assert.deepEqual(requiredProfileFields("student"), [
    "collegeName",
    "department",
    "state",
    "city",
    "phone",
    "degree",
    "studyYear",
  ]);
  assert.deepEqual(requiredProfileFields("teacher"), [
    "collegeName",
    "department",
    "state",
    "city",
    "phone",
    "designation",
    "qualification",
  ]);
});

test("student details land in the student bucket", () => {
  const { profile, missing } = buildProfile(studentPayload, {}, "student");
  assert.equal(missing, null);
  assert.equal(profile.complete, true);
  assert.equal(profile.student.degree, "B.Tech");
  assert.equal(profile.student.studyYear, "3rd Year");
  assert.deepEqual(profile.teacher, {});
  assert.equal(profile.collegeName, "Anna University");
});

test("teacher details land in the teacher bucket", () => {
  const { profile, missing } = buildProfile(teacherPayload, {}, "teacher");
  assert.equal(missing, null);
  assert.equal(profile.complete, true);
  assert.equal(profile.teacher.designation, "Associate Professor");
  assert.equal(profile.teacher.qualification, "Ph.D");
  assert.deepEqual(profile.student, {});
});

test("a role cannot write the other role's fields by posting them", () => {
  const { profile } = buildProfile(
    { ...studentPayload, designation: "Hacked", qualification: "Ph.D" },
    {},
    "student"
  );
  assert.ok(!profile.teacher.designation);
  assert.ok(!profile.teacher.qualification);

  const asTeacher = buildProfile({ ...teacherPayload, degree: "B.Tech" }, {}, "teacher");
  assert.ok(!asTeacher.profile.student.degree);
});

test("a stale bucket from a previous role is cleared", () => {
  const stored = {
    collegeName: "Anna University",
    student: { degree: "B.Tech", studyYear: "3rd Year" },
    teacher: {},
  };
  const { profile } = buildProfile({ designation: "Lecturer" }, stored, "teacher");
  assert.deepEqual(profile.student, {});
  assert.equal(profile.teacher.designation, "Lecturer");
});

test("a missing role field is reported by name", () => {
  assert.equal(missingProfileField({ ...studentPayload, degree: "" }, "student"), "degree");
  assert.equal(missingProfileField({ ...studentPayload, studyYear: "  " }, "student"), "studyYear");
  assert.equal(missingProfileField({ ...teacherPayload, qualification: "" }, "teacher"), "qualification");
  assert.equal(profileFieldLabel("studyYear"), "year of study");
  assert.equal(profileFieldLabel("collegeName"), "college name");
});

test("a student is not asked for teacher fields and vice versa", () => {
  assert.equal(missingProfileField(studentPayload, "student"), null);
  assert.equal(missingProfileField(teacherPayload, "teacher"), null);
});

test("complete is derived, never trusted from the request", () => {
  const { profile, missing } = buildProfile(
    { ...studentPayload, complete: true, phone: "" },
    {},
    "student"
  );
  assert.notEqual(missing, null);
  assert.equal(profile.complete, false);
});

test("optional blank fields still count as complete", () => {
  assert.equal(isProfileComplete(studentPayload, "student"), true);
  assert.equal(isProfileComplete(teacherPayload, "teacher"), true);
  const { profile } = buildProfile({ ...studentPayload, about: "", pincode: "" }, {}, "student");
  assert.equal(profile.complete, true);
});

test("a posted blank clears a stored value, an absent field is preserved", () => {
  const stored = buildProfile(studentPayload, {}, "student").profile;
  const cleared = buildProfile({ about: "" }, stored, "student");
  assert.equal(cleared.profile.about, "");
  assert.equal(cleared.profile.student.degree, "B.Tech");

  const untouched = buildProfile({ city: "Coimbatore" }, stored, "student");
  assert.equal(untouched.profile.city, "Coimbatore");
  assert.equal(untouched.profile.student.studyYear, "3rd Year");
});

test("a locked college name cannot be overwritten", () => {
  const stored = buildProfile(studentPayload, {}, "student").profile;
  const { profile } = buildProfile(
    { collegeName: "Some Other University" },
    stored,
    "student",
    "Anna University"
  );
  assert.equal(profile.collegeName, "Anna University");
});

test("non-http URLs are dropped rather than stored", () => {
  const { profile } = buildProfile(
    { ...studentPayload, photoUrl: "javascript:alert(1)", resumeUrl: "https://example.com/cv.pdf" },
    {},
    "student"
  );
  assert.equal(profile.photoUrl, "");
  assert.equal(profile.resumeUrl, "https://example.com/cv.pdf");
});

test("an unknown role falls back to the student allowlist", () => {
  assert.deepEqual(profileDetailBucket("hacker"), "student");
  const { profile } = buildProfile({ ...studentPayload, designation: "Nope" }, {}, "hacker");
  assert.ok(!profile.teacher.designation);
});

test("admin has no role fields to fill", () => {
  assert.deepEqual(requiredProfileFields("admin"), [
    "collegeName",
    "department",
    "state",
    "city",
    "phone",
  ]);
  const { profile } = buildProfile({ ...teacherPayload, designation: "X" }, {}, "admin");
  assert.deepEqual(profile.student, {});
  assert.deepEqual(profile.teacher, {});
});
