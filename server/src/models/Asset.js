import mongoose from "mongoose";

const assetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["video", "document"], required: true },
    course: { type: String, required: true },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    url: { type: String, default: "" },
    objectKey: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

assetSchema.methods.toPublic = function () {
  const asset = this.toObject();
  delete asset.__v;
  return asset;
};

export const Asset = mongoose.models.Asset || mongoose.model("Asset", assetSchema);
