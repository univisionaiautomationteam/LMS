import bcrypt from "bcryptjs";
import { College } from "../models/College.js";
import { User } from "../models/User.js";
import { serverError, validateEmail, PASSWORD_MIN } from "../utils/helpers.js";
import { isSuperAdmin, canAdminCollege } from "../utils/scope.js";

/** Turns "ABC.edu, xyz.com" into ["abc.edu", "xyz.com"] (lowercase, deduped). */
function normalizeDomains(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(/[\s,;]+/);
  const seen = new Set();
  for (const raw of list) {
    const domain = String(raw ?? "").trim().toLowerCase().replace(/^@+/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (domain) seen.add(domain);
  }
  return [...seen];
}

export async function listColleges(req, res) {
  try {
    // Super admin sees the whole directory; everyone else resolves only their
    // own college (students included).
    const filter = isSuperAdmin(req.user) ? {} : { _id: req.user.collegeId ?? null };
    const colleges = await College.find(filter).sort({ name: 1 });
    res.json({ colleges: colleges.map((college) => college.toPublic()) });
  } catch (error) {
    serverError(res, error, "colleges.list");
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

    // Its first college admin is provisioned in the same step. Validate those
    // fields up front so a bad admin row cannot leave a college without an admin.
    const adminName = String(req.body.adminName ?? "").trim();
    const adminEmail = String(req.body.adminEmail ?? "").trim().toLowerCase();
    const adminPassword = String(req.body.adminPassword ?? "");
    const wantsAdmin = Boolean(adminName || adminEmail || adminPassword);
    if (wantsAdmin) {
      if (!adminName) return res.status(400).json({ error: "College admin name is required." });
      if (!validateEmail(adminEmail)) return res.status(400).json({ error: "A valid college admin email is required." });
      if (adminPassword.length < PASSWORD_MIN) {
        return res.status(400).json({ error: `College admin password must be at least ${PASSWORD_MIN} characters.` });
      }
      const adminExists = await User.findOne({ email: adminEmail });
      if (adminExists) return res.status(409).json({ error: "An account with this email already exists." });
    }

    const college = await College.create({
      name,
      code,
      state: String(req.body.state ?? "").trim(),
      domains: normalizeDomains(req.body.domains),
    });

    let admin = null;
    if (wantsAdmin) {
      admin = await User.create({
        name: adminName,
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: "collegeAdmin",
        mustChangePassword: true,
        collegeId: college._id,
      });
    }
    res.status(201).json({ college: college.toPublic(), admin: admin ? admin.toPublic() : null });
  } catch (error) {
    serverError(res, error, "colleges.create");
  }
}

export async function addDepartment(req, res) {
  try {
    const college = await College.findById(req.params.id);
    if (!college) return res.status(404).json({ error: "College was not found." });
    if (!canAdminCollege(req.user, college._id)) {
      return res.status(403).json({ error: "You can only manage your own college." });
    }
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
    serverError(res, error, "colleges.addDepartment");
  }
}

export async function updateDepartmentAccess(req, res) {
  try {
    const college = await College.findById(req.params.id);
    if (!college) return res.status(404).json({ error: "College was not found." });
    if (!canAdminCollege(req.user, college._id)) {
      return res.status(403).json({ error: "You can only manage your own college." });
    }
    const department = college.departments.id(req.params.departmentId);
    if (!department) return res.status(404).json({ error: "Department was not found." });

    if (Array.isArray(req.body.allowedCourseIds)) department.allowedCourseIds = req.body.allowedCourseIds.map(String);
    if (typeof req.body.active === "boolean") department.active = req.body.active;
    college.markModified("departments");
    await college.save();
    res.json({ college: college.toPublic() });
  } catch (error) {
    serverError(res, error, "colleges.updateAccess");
  }
}

export async function updateCollege(req, res) {
  try {
    const college = await College.findById(req.params.id);
    if (!college) return res.status(404).json({ error: "College was not found." });
    if (!canAdminCollege(req.user, college._id)) {
      return res.status(403).json({ error: "You can only manage your own college." });
    }
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: "College name is required." });
      college.name = name;
    }
    if (req.body.state !== undefined) college.state = String(req.body.state).trim();
    if (req.body.domains !== undefined) college.domains = normalizeDomains(req.body.domains);
    if (typeof req.body.active === "boolean") college.active = req.body.active;
    await college.save();
    res.json({ college: college.toPublic() });
  } catch (error) {
    serverError(res, error, "colleges.update");
  }
}

export async function deleteCollege(req, res) {
  try {
    const college = await College.findByIdAndDelete(req.params.id);
    if (!college) return res.status(404).json({ error: "College was not found." });
    await User.updateMany({ collegeId: college._id }, { $set: { collegeId: null, departmentId: null } });
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error, "colleges.delete");
  }
}
