import { Course } from "../models/Course.js";
import { slugify } from "../utils/helpers.js";

export async function listCourses(_req, res) {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json({ courses: courses.map((course) => course.toPublic()) });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    });
    res.status(201).json({ course: course.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateCourse(req, res) {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      {
        title: String(req.body.title ?? "").trim(),
        category: String(req.body.category ?? "").trim(),
        description: String(req.body.description ?? "").trim(),
        level: String(req.body.level ?? "Beginner"),
        icon: String(req.body.icon ?? "").trim().slice(0, 3),
      },
      { new: true }
    );
    if (!course) return res.status(404).json({ error: "Course was not found." });
    res.json({ course: course.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteCourse(req, res) {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ error: "Course was not found." });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
