import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true },
    learnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const QuizAttempt =
  mongoose.models.QuizAttempt || mongoose.model("QuizAttempt", quizAttemptSchema);
