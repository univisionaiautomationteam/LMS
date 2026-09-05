import mongoose from "mongoose";

const lessonProgressSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true },
    lessonId: { type: String, required: true },
    learnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

lessonProgressSchema.index({ learnerId: 1, courseId: 1, lessonId: 1 }, { unique: true });

export const LessonProgress =
  mongoose.models.LessonProgress || mongoose.model("LessonProgress", lessonProgressSchema);
