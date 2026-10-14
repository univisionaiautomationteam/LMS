import mongoose from "mongoose";
import { defaultCurriculum, flattenModules, modulesFor } from "../utils/curriculum.js";

const quizQuestionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true },
    options: { type: [String], default: [] },
    answer: { type: Number, default: 0 },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, default: "Module knowledge check" },
    passScore: { type: Number, default: 60 },
    questions: { type: [quizQuestionSchema], default: [] },
  },
  { _id: false }
);

const lessonSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ["video", "code", "quiz", "document"], default: "video" },
    duration: { type: String, default: "" },
    // The lesson's own video/document, linked by the teacher in the builder.
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", default: null },
    // Present only on a `quiz` lesson authored by the teacher.
    quiz: { type: quizSchema, default: null },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const moduleSchema = new mongoose.Schema(
  {
    moduleId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    lessons: { type: [lessonSchema], default: [] },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    language: { type: String, default: "Engineering" },
    category: { type: String, default: "Engineering" },
    icon: { type: String, default: "EN" },
    color: { type: String, default: "#116653" },
    level: { type: String, enum: ["Beginner", "Intermediate", "Advanced"], default: "Beginner" },
    lessons: { type: Number, default: 24 },
    duration: { type: String, default: "8h 00m" },
    description: { type: String, default: "" },
    // Ownership: a teacher's portal only ever shows courses where they are the
    // owner. `createdByRole` lets the read filter tell "platform/admin course"
    // apart from "another teacher's course" without a second query.
    createdBy: { type: String, default: "" },
    createdByRole: { type: String, default: "" },
    lastUpdatedBy: { type: String, default: "" },
    // Which college owns this course. `null` means a platform-wide course that
    // every college can see (seed/admin catalog); a set value confines it to
    // that college so a teacher's upload never leaks into another institution.
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", default: null },
    // Authoring source of truth: modules → lessons. Progress is tracked per
    // lesson `key`. `curriculum` is a derived flat list kept for older readers.
    modules: { type: [moduleSchema], default: [] },
    curriculum: { type: [lessonSchema], default: () => defaultCurriculum.map((lesson) => ({ ...lesson })) },
  },
  { timestamps: true }
);

courseSchema.methods.toPublic = function () {
  const course = this.toObject();
  delete course.__v;
  // Legacy/seeded courses predate authoring, so present them as one default
  // module and keep the flat `curriculum` in step for existing consumers.
  const modules = course.modules?.length ? course.modules : modulesFor(course);
  course.modules = modules;
  course.curriculum = flattenModules(modules).length ? flattenModules(modules) : course.curriculum;
  return course;
};

export const Course = mongoose.models.Course || mongoose.model("Course", courseSchema);
