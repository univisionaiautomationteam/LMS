import mongoose from "mongoose";

const assetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["video", "document"], required: true },
    course: { type: String, required: true },
    // Optional: the lesson this file was uploaded for, set by the teacher's
    // curriculum builder. Lets the library show *where* a video lives.
    lessonKey: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    url: { type: String, default: "" },
    objectKey: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    // Mirrors the owning course's college so assets can be scoped without a
    // join; `null` means a platform-wide course's content.
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", default: null },
  },
  { timestamps: true }
);

assetSchema.methods.toPublic = function () {
  const asset = this.toObject();
  delete asset.__v;
  return asset;
};

export const Asset = mongoose.models.Asset || mongoose.model("Asset", assetSchema);
