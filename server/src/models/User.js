import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const profileSchema = new mongoose.Schema(
  {
    collegeName: { type: String, default: "" },
    department: { type: String, default: "" },
    degree: { type: String, default: "" },
    studyYear: { type: String, default: "" },
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    pincode: { type: String, default: "" },
    phone: { type: String, default: "" },
    about: { type: String, default: "" },
    photoUrl: { type: String, default: "" },
    resumeUrl: { type: String, default: "" },
    resumeName: { type: String, default: "" },
    complete: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "teacher", "student"], default: "student" },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    studentId: { type: String, default: "" },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    department: { type: String, default: "" },
    collegeNameLocked: { type: Boolean, default: false },
    profile: { type: profileSchema, default: () => ({}) },
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
