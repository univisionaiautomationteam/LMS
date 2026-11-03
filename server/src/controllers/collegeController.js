import bcrypt from "bcryptjs";
import { College } from "../models/College.js";
import { CollegeAdmin } from "../models/CollegeAdmin.js";
import { Teacher } from "../models/Teacher.js";
import { Student } from "../models/Student.js";
import { findUserByEmail } from "../utils/userLookup.js";
import { serverError, validateEmail, PASSWORD_MIN } from "../utils/helpers.js";
import { isSuperAdmin, canAdminCollege } from "../utils/scope.js";
import {
  normalizeDomains,
  findDomainConflict,
  assertEmailAllowedForCollege,
  emailDomain,
} from "../utils/domains.js";
import { statsForCollege } from "../utils/collegeStats.js";

export { normalizeDomains };

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
      const adminExists = await findUserByEmail(adminEmail);
      if (adminExists) return res.status(409).json({ error: "An account with this email already exists." });
    }

    const domains = normalizeDomains(req.body.domains);
    if (!domains.length) {
      return res.status(400).json({ error: "Add at least one email domain (e.g. @abc.com) for this college." });
    }
    const conflict = await findDomainConflict(domains);
    if (!conflict.ok) {
      return res.status(409).json({
        error: `@${conflict.domain} is already used by ${conflict.owner.code}. Each domain can belong to one college only.`,
      });
    }
    if (wantsAdmin) {
      const adminDomain = emailDomain(adminEmail);
      if (!domains.includes(adminDomain)) {
        return res.status(400).json({
          error: `College admin email must use one of this college's domains (${domains.map((d) => `@${d}`).join(", ")}).`,
        });
      }
    }

    const college = await College.create({
      name,
      code,
      state: String(req.body.state ?? "").trim(),
      domains,
    });

    let admin = null;
    if (wantsAdmin) {
      admin = await CollegeAdmin.create({
        name: adminName,
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: "collegeAdmin",
        mustChangePassword: true,
        collegeId: college._id,
        collegeNameLocked: true,
        profile: { collegeName: name },
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

export async function updateDepartment(req, res) {
  try {
    const college = await College.findById(req.params.id);
    if (!college) return res.status(404).json({ error: "College was not found." });
    if (!canAdminCollege(req.user, college._id)) {
      return res.status(403).json({ error: "You can only manage your own college." });
    }
    const department = college.departments.id(req.params.departmentId);
    if (!department) return res.status(404).json({ error: "Department was not found." });
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: "Department name is required." });
      department.name = name;
    }
    if (req.body.code !== undefined) {
      const code = String(req.body.code).trim().toUpperCase();
      if (!code) return res.status(400).json({ error: "Department code is required." });
      if (college.departments.some((d) => d._id.toString() !== req.params.departmentId && d.code === code)) {
        return res.status(409).json({ error: "This department code already exists in the college." });
      }
      department.code = code;
    }
    if (typeof req.body.active === "boolean") department.active = req.body.active;
    college.markModified("departments");
    await college.save();
    res.json({ college: college.toPublic() });
  } catch (error) {
    serverError(res, error, "colleges.updateDepartment");
  }
}

export async function deleteDepartment(req, res) {
  try {
    const college = await College.findById(req.params.id);
    if (!college) return res.status(404).json({ error: "College was not found." });
    if (!canAdminCollege(req.user, college._id)) {
      return res.status(403).json({ error: "You can only manage your own college." });
    }
    const department = college.departments.id(req.params.departmentId);
    if (!department) return res.status(404).json({ error: "Department was not found." });
    college.departments.pull({ _id: req.params.departmentId });
    college.markModified("departments");
    await college.save();
    res.json({ college: college.toPublic() });
  } catch (error) {
    serverError(res, error, "colleges.deleteDepartment");
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
    if (req.body.code !== undefined) {
      const code = String(req.body.code).trim().toUpperCase();
      if (!code) return res.status(400).json({ error: "College code is required." });
      if (code !== college.code) {
        const taken = await College.findOne({ code });
        if (taken && String(taken._id) !== String(college._id)) {
          return res.status(409).json({ error: "A college with this code already exists." });
        }
        college.code = code;
      }
    }
    if (req.body.state !== undefined) college.state = String(req.body.state).trim();
    if (req.body.domains !== undefined) {
      const domains = normalizeDomains(req.body.domains);
      if (!domains.length) {
        return res.status(400).json({ error: "Add at least one email domain (e.g. @abc.com)." });
      }
      const conflict = await findDomainConflict(domains, college._id);
      if (!conflict.ok) {
        return res.status(409).json({
          error: `@${conflict.domain} is already used by ${conflict.owner.code}. Each domain can belong to one college only.`,
        });
      }
      college.domains = domains;
    }
    if (typeof req.body.active === "boolean") college.active = req.body.active;
    await college.save();
    res.json({ college: college.toPublic() });
  } catch (error) {
    serverError(res, error, "colleges.update");
  }
}

export async function getCollegeStats(req, res) {
  try {
    const college = await College.findById(req.params.id);
    if (!college) return res.status(404).json({ error: "College was not found." });
    if (!isSuperAdmin(req.user) && !canAdminCollege(req.user, college._id)) {
      return res.status(403).json({ error: "You can only view your own college." });
    }
    const stats = await statsForCollege(college._id);
    res.json({ stats });
  } catch (error) {
    serverError(res, error, "colleges.stats");
  }
}

export async function listCollegesWithStats(req, res) {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Only the super admin can list all college statistics." });
    }
    const colleges = await College.find({}).sort({ name: 1 }).lean();
    const stats = await Promise.all(colleges.map((c) => statsForCollege(c._id)));
    res.json({ colleges: stats.filter(Boolean) });
  } catch (error) {
    serverError(res, error, "colleges.statsAll");
  }
}

export async function deleteCollege(req, res) {
  try {
    const college = await College.findByIdAndDelete(req.params.id);
    if (!college) return res.status(404).json({ error: "College was not found." });
    // Remove all college admins, teachers, and students belonging to this college
    await CollegeAdmin.deleteMany({ collegeId: college._id });
    await Teacher.deleteMany({ collegeId: college._id });
    await Student.deleteMany({ collegeId: college._id });
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error, "colleges.delete");
  }
}
