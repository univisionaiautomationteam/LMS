import "dotenv/config";
import mongoose from "mongoose";
import { Admin } from "./models/Admin.js";
import { CollegeAdmin } from "./models/CollegeAdmin.js";
import { Teacher } from "./models/Teacher.js";
import { Student } from "./models/Student.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lms";

const MODEL_BY_ROLE = {
  admin: Admin,
  collegeAdmin: CollegeAdmin,
  teacher: Teacher,
  student: Student,
};

function pickPasswordHash(doc) {
  const hash = doc?.passwordHash ?? doc?.password;
  return typeof hash === "string" && hash.length > 0 ? hash : null;
}

function baseFields(doc) {
  return {
    name: doc.name,
    email: String(doc.email ?? "").trim().toLowerCase(),
    role: doc.role,
    active: doc.active !== false,
    mustChangePassword: Boolean(doc.mustChangePassword),
    tokenVersion: doc.tokenVersion ?? 0,
    collegeId: doc.collegeId ?? null,
    departmentId: doc.departmentId ?? null,
    department: doc.department ?? "",
    collegeNameLocked: doc.collegeNameLocked ?? false,
    studentId: doc.studentId ?? "",
    profile: doc.profile ?? {},
    weeklyGoal: doc.weeklyGoal ?? {},
  };
}

/**
 * Copy legacy `users` documents into role-specific collections (`admins`, etc.)
 * and backfill `passwordHash` when only `password` exists in MongoDB.
 */
async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const usersCol = mongoose.connection.collection("users");
    const legacyUsers = await usersCol.find({}).toArray();
    let upserted = 0;
    let skipped = 0;

    for (const doc of legacyUsers) {
      const role = doc.role;
      const Model = MODEL_BY_ROLE[role];
      if (!Model) {
        skipped += 1;
        console.warn(`Skip ${doc.email}: unknown role "${role}"`);
        continue;
      }
      const passwordHash = pickPasswordHash(doc);
      if (!passwordHash) {
        skipped += 1;
        console.warn(`Skip ${doc.email}: no passwordHash/password field`);
        continue;
      }
      if (role === "student" || role === "teacher") {
        if (!doc.collegeId) {
          skipped += 1;
          console.warn(`Skip ${doc.email}: ${role} missing collegeId`);
          continue;
        }
      }

      const payload = { ...baseFields(doc), passwordHash, role };
      if (role === "admin") {
        payload.collegeName = doc.collegeName ?? doc.profile?.collegeName ?? "TarasLearn";
      }

      await Model.updateOne({ email: payload.email }, { $set: payload }, { upsert: true });
      upserted += 1;
    }

    // Backfill passwordHash on role-collection rows that only have legacy `password`.
    for (const [role, Model] of Object.entries(MODEL_BY_ROLE)) {
      const cursor = Model.collection.find({});
      for await (const doc of cursor) {
        if (pickPasswordHash(doc)) continue;
        const legacy = await usersCol.findOne({ email: doc.email });
        const hash = pickPasswordHash(legacy);
        if (hash) {
          await Model.collection.updateOne({ _id: doc._id }, { $set: { passwordHash: hash } });
          console.log(`Backfilled passwordHash for ${doc.email} (${role})`);
        }
      }
    }

    console.log(`Users migrated/updated: ${upserted}, skipped: ${skipped}`);
    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
