import mongoose from "mongoose";
import { Course } from "../models/Course.js";
import { Asset } from "../models/Asset.js";
import { College } from "../models/College.js";
import { slugify, serverError } from "../utils/helpers.js";
import {
  resolveCourseAccess,
  courseScopeFilter,
  canManageCourse,
  teacherCourseFilter,
} from "../utils/access.js";
import { collegeVisibilityFilter } from "../utils/scope.js";
import { normalizeModules, flattenModules } from "../utils/curriculum.js";

/**
 * The client addresses courses by slug in edit/delete forms, so lookups accept
 * either an ObjectId or a slug. A raw findById(slug) would throw a CastError
 * and surface as a 500.
 */
async function findCourse(idOrSlug) {
  const key = String(idOrSlug ?? "");
  if (mongoose.isValidObjectId(key)) {
    const byId = await Course.findById(key);
    if (byId) return byId;
  }
  return Course.findOne({ slug: key });
}

export async function listCourses(req, res) {
  try {
    const access = await resolveCourseAccess(req.user);
    // Combine three concerns so no single filter can silently widen the query:
    // department access (students), teacher ownership, and college isolation.
    const conditions = [];
    const scopeFilter = courseScopeFilter(access);
    if (Object.keys(scopeFilter).length) conditions.push(scopeFilter);
    if (req.user?.role === "teacher") conditions.push(teacherCourseFilter(req.user.email));
    const collegeFilter = collegeVisibilityFilter(req.user);
    if (Object.keys(collegeFilter).length) conditions.push(collegeFilter);
    const filter = conditions.length ? { $and: conditions } : {};
    const courses = await Course.find(filter).sort({ createdAt: -1 });
    res.json({ courses: courses.map((course) => course.toPublic()) });
  } catch (error) {
    serverError(res, error, "courses.list");
  }
}

export async function listMyCourses(req, res) {
  try {
    const courses = await Course.find({ createdBy: req.user.email }).sort({ createdAt: -1 });
    res.json({ courses: courses.map((course) => course.toPublic()) });
  } catch (error) {
    serverError(res, error, "courses.mine");
  }
}

export async function createCourse(req, res) {
  try {
    const title = String(req.body.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "Course title is required." });
    const slug = slugify(title);
    if (!slug) return res.status(400).json({ error: "Course title must include letters or numbers." });
    const existing = await Course.findOne({ slug });
    if (existing) return res.status(409).json({ error: "A course with this title already exists." });

    const course = await Course.create({
      slug,
      title,
      category: String(req.body.category ?? "Engineering").trim(),
      description: String(req.body.description ?? "").trim(),
      level: String(req.body.level ?? "Beginner"),
      icon: String(req.body.icon ?? "").trim().slice(0, 3) || "EN",
      lessons: Number(req.body.lessons) || 24,
      duration: String(req.body.duration ?? "8h 00m"),
      language: String(req.body.language ?? "Engineering"),
      createdBy: req.user.email,
      createdByRole: req.user.role,
      lastUpdatedBy: req.user.email,
      // A teacher/college admin's course is owned by their college; the super
      // admin (no college) publishes platform-wide courses everyone can see.
      collegeId: req.user.collegeId ?? null,
    });

    // A teacher's fresh course is granted to their own department right away,
    // so the students they were hired to teach see it without the college admin
    // having to flip the access switch for every upload.
    if (req.user.role === "teacher" && req.user.collegeId) {
      const match = req.user.departmentId
        ? { "departments._id": req.user.departmentId }
        : req.user.department
        ? { "departments.name": req.user.department }
        : null;
      if (match) {
        await College.updateOne(
          { _id: req.user.collegeId, ...match },
          { $addToSet: { "departments.$.allowedCourseIds": slug } }
        );
      }
    }

    res.status(201).json({ course: course.toPublic() });
  } catch (error) {
    serverError(res, error, "course.write");
  }
}

export async function updateCourse(req, res) {
  try {
    const course = await findCourse(req.params.id);
    if (!course) return res.status(404).json({ error: "Course was not found." });
    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ error: "You can only edit courses you created." });
    }

    course.title = String(req.body.title ?? "").trim() || course.title;
    course.category = String(req.body.category ?? "").trim();
    course.description = String(req.body.description ?? "").trim();
    course.level = String(req.body.level ?? course.level);
    course.icon = String(req.body.icon ?? "").trim().slice(0, 3);
    if (Number(req.body.lessons)) course.lessons = Number(req.body.lessons);
    if (req.body.duration) course.duration = String(req.body.duration);
    course.lastUpdatedBy = req.user.email;
    await course.save();

    res.json({ course: course.toPublic() });
  } catch (error) {
    serverError(res, error, "course.write");
  }
}

/**
 * Replaces a course's outline (modules → lessons → quizzes) in one save. The
 * teacher owns the whole tree client-side; the server normalises it so keys stay
 * stable (progress survives edits) and quiz answers stay valid indices.
 */
export async function updateCurriculum(req, res) {
  try {
    const course = await findCourse(req.params.id);
    if (!course) return res.status(404).json({ error: "Course was not found." });
    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ error: "You can only edit courses you created." });
    }

    const modules = normalizeModules(req.body?.modules);
    if (!modules.length || modules.every((module) => module.lessons.length === 0)) {
      return res.status(400).json({ error: "Add at least one module with one lesson." });
    }

    course.modules = modules;
    // Keep the derived flat list and the summary lesson count in step with the
    // authored outline so older readers and course cards stay accurate.
    course.curriculum = flattenModules(modules);
    course.lessons = course.curriculum.length;
    course.lastUpdatedBy = req.user.email;
    await course.save();

    res.json({ course: course.toPublic() });
  } catch (error) {
    serverError(res, error, "course.curriculum");
  }
}

export async function deleteCourse(req, res) {
  try {
    const course = await findCourse(req.params.id);
    if (!course) return res.status(404).json({ error: "Course was not found." });
    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ error: "You can only delete courses you created." });
    }
    await Course.deleteOne({ _id: course._id });
    // Drop the slug from every department's grant list so a deleted course does
    // not linger as a dangling access entry on the college access grid.
    await College.updateMany(
      { "departments.allowedCourseIds": course.slug },
      { $pull: { "departments.$[].allowedCourseIds": course.slug } }
    );
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error, "course.write");
  }
}

/** Aggregates for the teacher dashboard: what I created, what I updated, how big the catalog is. */
export async function teacherStats(req, res) {
  try {
    const email = req.user.email;
    const [mine, catalogTotal, myAssets] = await Promise.all([
      Course.find({ createdBy: email }).sort({ updatedAt: -1 }),
      Course.countDocuments({}),
      Asset.find({ createdBy: email }).select("size course"),
    ]);

    // "Updated" means a course I own whose content changed after creation.
    const coursesCreated = mine.length;
    const coursesUpdated = mine.filter(
      (course) => new Date(course.updatedAt).getTime() - new Date(course.createdAt).getTime() > 1000
    ).length;
    const lessonsTotal = mine.reduce((sum, course) => sum + (course.lessons || 0), 0);
    const storageBytes = myAssets.reduce((sum, asset) => sum + (asset.size || 0), 0);
    const coursesCovered = new Set(myAssets.map((asset) => asset.course)).size;

    res.json({
      coursesCreated,
      coursesUpdated,
      coursesTotal: catalogTotal,
      lessonsTotal,
      assetsUploaded: myAssets.length,
      coursesCovered,
      storageBytes,
      profileComplete: Boolean(req.user.profile?.complete),
      recentCourses: mine.slice(0, 5).map((course) => ({
        slug: course.slug,
        title: course.title,
        icon: course.icon,
        color: course.color,
        lessons: course.lessons,
        updatedAt: course.updatedAt,
      })),
    });
  } catch (error) {
    serverError(res, error, "teacher.stats");
  }
}

export { findCourse };
