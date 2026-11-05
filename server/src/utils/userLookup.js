import { Admin } from "../models/Admin.js";
import { CollegeAdmin } from "../models/CollegeAdmin.js";
import { Teacher } from "../models/Teacher.js";
import { Student } from "../models/Student.js";
import { User } from "../models/User.js";
import { resolvePasswordHash } from "./passwordHash.js";

const MODEL_BY_ROLE = {
  admin: Admin,
  collegeAdmin: CollegeAdmin,
  teacher: Teacher,
  student: Student,
};

/** Get the Mongoose model for a given role. */
export function getUserModel(role) {
  return MODEL_BY_ROLE[role];
}

/** Find a user by email across all role collections. Returns { user, role } or null. */
export async function findUserByEmail(email) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  for (const [role, Model] of Object.entries(MODEL_BY_ROLE)) {
    const user = await Model.findOne({ email: normalizedEmail });
    if (user) {
      const hash = await resolvePasswordHash(user);
      if (hash) return { user, role };
    }
  }
  const legacy = await User.findOne({ email: normalizedEmail });
  if (legacy) {
    const hash = await resolvePasswordHash(legacy);
    if (hash) {
      const role = legacy.role || "student";
      return { user: legacy, role };
    }
  }
  return null;
}

/** Find a user by ID across all role collections. Returns { user, role } or null. */
export async function findUserById(id) {
  for (const [role, Model] of Object.entries(MODEL_BY_ROLE)) {
    const user = await Model.findById(id);
    if (user) return { user, role };
  }
  const legacy = await User.findById(id);
  if (legacy) {
    const role = legacy.role || "student";
    return { user: legacy, role };
  }
  return null;
}

/** Get all users across all collections, optionally filtered by collegeId. */
export async function findAllUsers(collegeId = null, roleFilter = null) {
  const results = [];
  for (const [role, Model] of Object.entries(MODEL_BY_ROLE)) {
    if (roleFilter && role !== roleFilter) continue;
    const query = collegeId ? { collegeId } : {};
    const users = await Model.find(query);
    for (const u of users) {
      results.push({ ...u.toPublic(), role });
    }
  }
  return results;
}

/** Count users across all collections, optionally filtered. */
export async function countUsers(collegeId = null, roleFilter = null) {
  let total = 0;
  for (const [role, Model] of Object.entries(MODEL_BY_ROLE)) {
    if (roleFilter && role !== roleFilter) continue;
    const query = collegeId ? { collegeId } : {};
    total += await Model.countDocuments(query);
  }
  return total;
}
