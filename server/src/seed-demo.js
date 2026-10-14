import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "./models/User.js";
import { Course } from "./models/Course.js";
import { College } from "./models/College.js";

/**
 * Creates a ready-to-use demo college with a college admin, teacher and
 * student so the multi-tenant flow can be exercised by hand. Idempotent:
 * re-running it resets the passwords and re-links the accounts.
 *
 *   College admin : college.admin@demo.edu / College@2026
 *   Teacher       : teacher@demo.edu       / Teacher@2026
 *   Student       : student@demo.edu       / Student@2026
 */
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lms";

const COLLEGE = { name: "Demo Institute of Technology", code: "DEMOIT", state: "Karnataka", domains: ["demo.edu"] };
const CADMIN = { name: "Demo College Admin", email: "college.admin@demo.edu", password: "College@2026" };
const TEACHER = { name: "Demo Teacher", email: "teacher@demo.edu", password: "Teacher@2026" };
const STUDENT = { name: "Demo Student", email: "student@demo.edu", password: "Student@2026" };

async function upsertUser({ name, email, password, role, collegeId = null, departmentId = null, department = "" }) {
  return User.findOneAndUpdate(
    { email },
    {
      $set: {
        name,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        collegeId,
        departmentId,
        department,
        active: true,
        mustChangePassword: false,
        tokenVersion: 0,
      },
      $setOnInsert: { email, collegeNameLocked: false },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const college = await College.findOneAndUpdate(
      { code: COLLEGE.code },
      { $set: { name: COLLEGE.name, state: COLLEGE.state, domains: COLLEGE.domains, active: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Give the demo department access to every platform course so students see content.
    const platformSlugs = (await Course.find({ collegeId: null }).select("slug").lean()).map((c) => c.slug);
    const cse = college.departments.find((d) => d.code === "CSE");
    if (cse) {
      cse.allowedCourseIds = platformSlugs;
    } else {
      college.departments.push({ name: "Computer Science", code: "CSE", active: true, allowedCourseIds: platformSlugs });
    }
    college.markModified("departments");
    await college.save();
    const departmentId = college.departments.find((d) => d.code === "CSE")?._id ?? null;

    await upsertUser({ ...CADMIN, role: "collegeAdmin", collegeId: college._id });
    await upsertUser({ ...TEACHER, role: "teacher", collegeId: college._id, departmentId, department: "Computer Science" });
    await upsertUser({ ...STUDENT, role: "student", collegeId: college._id, departmentId, department: "Computer Science" });

    console.log("\nDemo data ready. Sign in with:");
    console.log(`  College admin : ${CADMIN.email} / ${CADMIN.password}`);
    console.log(`  Teacher       : ${TEACHER.email} / ${TEACHER.password}`);
    console.log(`  Student       : ${STUDENT.email} / ${STUDENT.password}`);
    console.log(`  College       : ${college.code} — ${college.name} (domains: ${college.domains.join(", ")})`);
    console.log("\nSeed complete.");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();
