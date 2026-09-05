import mongoose from "mongoose";

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
  },
  { timestamps: true }
);

courseSchema.methods.toPublic = function () {
  const course = this.toObject();
  delete course.__v;
  return course;
};

export const Course = mongoose.models.Course || mongoose.model("Course", courseSchema);
