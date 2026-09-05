import { College } from "../models/College.js";
import { User } from "../models/User.js";

export async function listColleges(_req, res) {
  try {
    const colleges = await College.find().sort({ name: 1 });
    res.json({ colleges: colleges.map((college) => college.toPublic()) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createCollege(req, res) {
  try {
    const name = String(req.body.name ?? "").trim();
    const code = String(req.body.code ?? "").trim().toUpperCase();
    if (!name) return res.status(400).json({ error: "College name is required." });
    if (!code) return res.status(400).json({ error: "College code is required." });
    const existing = await College.findOne({ code });
    if (existing) return res.status(409).json({ error: "A college with this code already exists." });

    const college = await College.create({
      name,
      code,
      state: String(req.body.state ?? "").trim(),
    });
    res.status(201).json({ college: college.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function addDepartment(req, res) {
  try {
    const college = await College.findById(req.params.id);
    if (!college) return res.status(404).json({ error: "College was not found." });
    const name = String(req.body.name ?? "").trim();
    const code = String(req.body.code ?? "").trim().toUpperCase();
    if (!name) return res.status(400).json({ error: "Department name is required." });
    if (!code) return res.status(400).json({ error: "Department code is required." });
    if (college.departments.some((d) => d.code === code)) {
      return res.status(409).json({ error: "This department code already exists in the college." });
    }
    college.departments.push({ name, code, active: true, allowedCourseIds: [] });
    await college.save();
    res.status(201).json({ college: college.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateDepartmentAccess(req, res) {
  try {
    const college = await College.findById(req.params.id);
    if (!college) return res.status(404).json({ error: "College was not found." });
    const department = college.departments.id(req.params.departmentId);
    if (!department) return res.status(404).json({ error: "Department was not found." });

    if (Array.isArray(req.body.allowedCourseIds)) department.allowedCourseIds = req.body.allowedCourseIds.map(String);
    if (typeof req.body.active === "boolean") department.active = req.body.active;
    college.markModified("departments");
    await college.save();
    res.json({ college: college.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteCollege(req, res) {
  try {
    const college = await College.findByIdAndDelete(req.params.id);
    if (!college) return res.status(404).json({ error: "College was not found." });
    await User.updateMany({ collegeId: college._id }, { $set: { collegeId: null, departmentId: null } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
