import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Admin } from "./models/Admin.js";
import { CollegeAdmin } from "./models/CollegeAdmin.js";
import { Teacher } from "./models/Teacher.js";
import { Student } from "./models/Student.js";
import { College } from "./models/College.js";
import { Course } from "./models/Course.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lms";

function storedPasswordHash(doc) {
  const hash = doc?.passwordHash ?? doc?.password;
  return typeof hash === "string" && hash.length > 0 ? hash : null;
}

const starterCourses = [
  { slug: "python", title: "Python from Zero to Builder", language: "Python", category: "Computer Science", icon: "Py", color: "#6c5ce7", level: "Beginner", lessons: 42, duration: "8h 20m", description: "Build strong Python foundations through practical exercises, data structures, and a capstone project." },
  { slug: "cpp", title: "Modern C++ Essentials", language: "C++", category: "Computer Science", icon: "C+", color: "#147d64", level: "Intermediate", lessons: 36, duration: "10h 05m", description: "Master memory, object-oriented design, STL, templates, and modern C++ patterns." },
  { slug: "java", title: "Java & Object-Oriented Design", language: "Java", category: "Computer Science", icon: "Ja", color: "#d96843", level: "Beginner", lessons: 48, duration: "12h 10m", description: "Learn Java syntax, OOP, collections, exceptions, and production-ready design practices." },
  { slug: "c", title: "C Programming: Core Foundations", language: "C", category: "Computer Science", icon: "C", color: "#2f6fdd", level: "Beginner", lessons: 31, duration: "7h 45m", description: "Understand how programs work through pointers, memory, structs, files, and algorithms." },
  { slug: "embedded-systems", title: "Embedded Systems & Microcontrollers", language: "Embedded", category: "Electronics", icon: "ES", color: "#8a5a44", level: "Beginner", lessons: 34, duration: "9h 15m", description: "Design firmware, interfaces, and real-time applications with modern microcontrollers." },
  { slug: "ai-ml", title: "Artificial Intelligence & Machine Learning", language: "AI/ML", category: "AI & Data", icon: "AI", color: "#a44747", level: "Intermediate", lessons: 52, duration: "14h 20m", description: "Build practical foundations in machine learning, neural networks, and responsible AI." },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Create or repair super admin in `admins` collection
    const adminEmail = "admin@taraslearn.com";
    const defaultAdminPassword = "Admin@12345";
    let admin = await Admin.findOne({ email: adminEmail });
    const adminRaw = admin ? await Admin.collection.findOne({ _id: admin._id }) : null;
    const legacyAdmin = await mongoose.connection.collection("users").findOne({ email: adminEmail, role: "admin" });
    const existingHash = storedPasswordHash(adminRaw) ?? storedPasswordHash(legacyAdmin);

    if (!admin) {
      await Admin.create({
        name: legacyAdmin?.name ?? "Platform Administrator",
        email: adminEmail,
        passwordHash: existingHash ?? (await bcrypt.hash(defaultAdminPassword, 10)),
        role: "admin",
        active: true,
        mustChangePassword: false,
        collegeNameLocked: true,
        collegeName: legacyAdmin?.collegeName ?? "TarasLearn",
      });
      console.log(`Created super admin: ${adminEmail} / ${defaultAdminPassword} (admins collection)`);
    } else if (!storedPasswordHash(adminRaw)) {
      admin.passwordHash = existingHash ?? (await bcrypt.hash(defaultAdminPassword, 10));
      await admin.save();
      console.log(`Repaired super admin password hash for ${adminEmail}`);
    }

    // Create a sample college and college admin
    let college = await College.findOne({ code: "NGP" });
    if (!college) {
      college = await College.create({
        name: "NGP Institute of Technology",
        code: "NGP",
        state: "Tamil Nadu",
        domains: ["ngp.com"],
      });
      console.log("Created college: NGP Institute of Technology");
    }

    const collegeAdminExists = await CollegeAdmin.exists({ email: "collegeadmin@ngp.com" });
    if (!collegeAdminExists) {
      await CollegeAdmin.create({
        name: "College Administrator",
        email: "collegeadmin@ngp.com",
        passwordHash: await bcrypt.hash("College@12345", 10),
        role: "collegeAdmin",
        mustChangePassword: false,
        collegeId: college._id,
        collegeNameLocked: true,
      });
      console.log("Created college admin: collegeadmin@ngp.com / College@12345 (collegeAdmins collection)");
    }

    // Create sample departments
    const deptExists = college.departments.some((d) => d.code === "CSE");
    if (!deptExists) {
      college.departments.push({ name: "Computer Science Engineering", code: "CSE", active: true, allowedCourseIds: [] });
      await college.save();
      console.log("Created department: CSE");
    }

    // Create sample teacher
    const teacherExists = await Teacher.exists({ email: "teacher@ngp.com" });
    if (!teacherExists) {
      const cseDept = college.departments.find((d) => d.code === "CSE");
      await Teacher.create({
        name: "Raja Kumar",
        email: "teacher@ngp.com",
        passwordHash: await bcrypt.hash("Teacher@12345", 10),
        role: "teacher",
        mustChangePassword: false,
        collegeId: college._id,
        departmentId: cseDept._id,
        department: "Computer Science Engineering",
      });
      console.log("Created teacher: teacher@ngp.com / Teacher@12345 (teachers collection)");
    }

    // Create sample student
    const studentExists = await Student.exists({ email: "student@ngp.com" });
    if (!studentExists) {
      const cseDept = college.departments.find((d) => d.code === "CSE");
      await Student.create({
        name: "Krishna Reddy",
        email: "student@ngp.com",
        passwordHash: await bcrypt.hash("Student@12345", 10),
        role: "student",
        mustChangePassword: false,
        studentId: "STU00001",
        collegeId: college._id,
        departmentId: cseDept._id,
        department: "Computer Science Engineering",
      });
      console.log("Created student: student@ngp.com / Student@12345 (students collection)");
    }

    let insertedCourses = 0;
    for (const course of starterCourses) {
      const courseExists = await Course.exists({ slug: course.slug });
      if (!courseExists) {
        await Course.create(course);
        insertedCourses += 1;
      }
    }
    console.log(`Courses: ${insertedCourses} inserted, ${starterCourses.length - insertedCourses} already present`);

    console.log("Seed complete.");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();
