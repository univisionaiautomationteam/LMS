import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/** Only ever written for `role: "student"`. */
const studentProfileSchema = new mongoose.Schema(
  {
    degree: { type: String, default: "" },
    studyYear: { type: String, default: "" },
    guardianName: { type: String, default: "" },
    guardianPhone: { type: String, default: "" },
    courseType: { type: String, default: "" },
  },
  { _id: false }
);

/** Only ever written for `role: "teacher"`. */
const teacherProfileSchema = new mongoose.Schema(
  {
    designation: { type: String, default: "" },
    qualification: { type: String, default: "" },
    specialization: { type: String, default: "" },
    experienceYears: { type: String, default: "" },
  },
  { _id: false }
);

const profileSchema = new mongoose.Schema(
  {
    collegeName: { type: String, default: "" },
    department: { type: String, default: "" },
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    pincode: { type: String, default: "" },
    phone: { type: String, default: "" },
    about: { type: String, default: "" },
    photoUrl: { type: String, default: "" },
    resumeUrl: { type: String, default: "" },
    resumeName: { type: String, default: "" },
    complete: { type: Boolean, default: false },
    student: { type: studentProfileSchema, default: () => ({}) },
    teacher: { type: teacherProfileSchema, default: () => ({}) },
  },
  { _id: false }
);

/**
 * Weekly goal, shared by every role. Stored in minutes so no float rounding
 * creeps in; `weekKey` (e.g. "2026-W41") marks the week the counters belong to
 * so a stale week resets to zero instead of carrying over forever.
 */
const weeklyGoalSchema = new mongoose.Schema(
  {
    targetMinutes: { type: Number, default: 300 },
    completedMinutes: { type: Number, default: 0 },
    weekKey: { type: String, default: "" },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "collegeAdmin", "teacher", "student"], default: "student" },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    studentId: { type: String, default: "" },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    department: { type: String, default: "" },
    collegeNameLocked: { type: Boolean, default: false },
    profile: { type: profileSchema, default: () => ({}) },
    weeklyGoal: { type: weeklyGoalSchema, default: () => ({}) },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toPublic = function () {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.__v;
  return user;
};

export const User = mongoose.models.User || mongoose.model("User", userSchema);
