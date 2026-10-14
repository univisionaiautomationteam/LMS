import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true },
    // The quiz lesson this attempt belongs to (a course may have several).
    lessonId: { type: String, default: "" },
    learnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    // Stored at submit time so the summary never has to re-derive each quiz's
    // pass mark (which is now authored per lesson).
    passed: { type: Boolean, default: false },
    passScore: { type: Number, default: 60 },
  },
  { timestamps: true }
);

export const QuizAttempt =
  mongoose.models.QuizAttempt || mongoose.model("QuizAttempt", quizAttemptSchema);
