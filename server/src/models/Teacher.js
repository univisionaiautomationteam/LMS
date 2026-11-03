import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/** Teacher / faculty account - stored in `teachers` collection. */
const teacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "teacher", enum: ["teacher"] },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    department: { type: String, default: "" },
    studentId: { type: String, default: "" },
    collegeNameLocked: { type: Boolean, default: false },
    profile: {
      collegeName: { type: String, default: "" },
      department: { type: String, default: "" },
      state: { type: String, default: "" },
      city: { type: String, default: "" },
      pincode: { type: String, default: "" },
      phone: { type: String, default: "" },
      about: { type: String, default: "" },
      photoUrl: { type: String, default: "" },
      teacher: {
        designation: { type: String, default: "" },
        qualification: { type: String, default: "" },
        specialization: { type: String, default: "" },
        experienceYears: { type: String, default: "" },
      },
    },
    weeklyGoal: {
      targetMinutes: { type: Number, default: 300 },
      completedMinutes: { type: Number, default: 0 },
      weekKey: { type: String, default: "" },
    },
  },
  { timestamps: true, collection: "teachers" }
);

teacherSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

teacherSchema.methods.toPublic = function () {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.__v;
  return user;
};

export const Teacher =
  mongoose.models.Teacher || mongoose.model("Teacher", teacherSchema);
