import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/** Super administrator account - stored in `admins` collection. */
const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "admin", enum: ["admin"] },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    collegeNameLocked: { type: Boolean, default: true },
    collegeName: { type: String, default: "TarasLearn" },
    profile: {
      collegeName: { type: String, default: "" },
      department: { type: String, default: "" },
      state: { type: String, default: "" },
      city: { type: String, default: "" },
      pincode: { type: String, default: "" },
      phone: { type: String, default: "" },
      about: { type: String, default: "" },
      photoUrl: { type: String, default: "" },
    },
    weeklyGoal: {
      targetMinutes: { type: Number, default: 300 },
      completedMinutes: { type: Number, default: 0 },
      weekKey: { type: String, default: "" },
    },
  },
  { timestamps: true, collection: "admins" }
);

adminSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

adminSchema.methods.toPublic = function () {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.__v;
  return user;
};

export const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema);
