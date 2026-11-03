import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/** Student account - stored in `students` collection. */
const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "student", enum: ["student"] },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    studentId: { type: String, default: "" },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    department: { type: String, default: "" },
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
      student: {
        degree: { type: String, default: "" },
        studyYear: { type: String, default: "" },
        guardianName: { type: String, default: "" },
        guardianPhone: { type: String, default: "" },
        courseType: { type: String, default: "" },
      },
    },
    weeklyGoal: {
      targetMinutes: { type: Number, default: 300 },
      completedMinutes: { type: Number, default: 0 },
      weekKey: { type: String, default: "" },
    },
  },
  { timestamps: true, collection: "students" }
);

studentSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

studentSchema.methods.toPublic = function () {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.__v;
  return user;
};

export const Student =
  mongoose.models.Student || mongoose.model("Student", studentSchema);
