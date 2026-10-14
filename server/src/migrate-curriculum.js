import "dotenv/config";
import mongoose from "mongoose";
import { Course } from "./models/Course.js";
import { flattenModules, modulesFor } from "./utils/curriculum.js";

/**
 * One-time migration for the module-wise curriculum rollout. Existing courses
 * predate authoring, so any course without `modules` is wrapped into a single
 * default module derived from its flat `curriculum`, and both the derived flat
 * list and the summary lesson count are written back. Safe to re-run.
 */
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lms";

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const courses = await Course.find({}).select("slug curriculum modules lessons");
    let migrated = 0;

    for (const course of courses) {
      if (course.modules?.length) continue;
      const modules = modulesFor(course.toObject());
      const flat = flattenModules(modules);
      course.modules = modules;
      course.curriculum = flat;
      course.lessons = flat.length;
      await course.save();
      migrated += 1;
    }

    console.log(`Courses wrapped into modules: ${migrated}`);
    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
