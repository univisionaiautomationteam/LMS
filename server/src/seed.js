import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "./models/User.js";
import { Course } from "./models/Course.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lms";

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

    const adminExists = await User.exists({ email: "admin@taraslearn.com" });
    if (!adminExists) {
      await User.create({
        name: "Platform Administrator",
        email: "admin@taraslearn.com",
        passwordHash: await bcrypt.hash("Admin@12345", 10),
        role: "admin",
        active: true,
        mustChangePassword: false,
        collegeNameLocked: true,
        collegeName: "TarasLearn",
      });
      console.log("Created admin account: admin@taraslearn.com / Admin@12345");
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
