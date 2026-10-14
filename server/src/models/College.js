import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    active: { type: Boolean, default: true },
    allowedCourseIds: { type: [String], default: [] },
  },
  { _id: true, timestamps: true }
);

const collegeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    state: { type: String, default: "" },
    active: { type: Boolean, default: true },
    // Email domains that map an address to this college, e.g. ["abc.edu"].
    // Used to route/validate bulk-imported accounts so `x@abc.edu` lands in ABC.
    domains: { type: [String], default: [] },
    allowedCourseIds: { type: [String], default: [] },
    departments: { type: [departmentSchema], default: [] },
  },
  { timestamps: true }
);

collegeSchema.methods.toPublic = function () {
  const college = this.toObject();
  delete college.__v;
  return college;
};

export const College = mongoose.models.College || mongoose.model("College", collegeSchema);
