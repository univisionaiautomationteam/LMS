import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { validateEmail, normalizeProfile } from "../utils/helpers.js";

export async function listUsers(_req, res) {
  try {
    const users = await User.find().sort({ role: 1, name: 1 });
    res.json({ users: users.map((user) => user.toPublic()) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createUser(req, res) {
  try {
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? req.body.temporaryPassword ?? "");
    const role = ["admin", "teacher", "student"].includes(req.body.role) ? req.body.role : "student";
    if (!name) return res.status(400).json({ error: "Full name is required." });
    if (!validateEmail(email)) return res.status(400).json({ error: "A valid email is required." });
    if (password.length < 10) return res.status(400).json({ error: "Temporary password must be at least 10 characters." });
    if (role === "student" && !req.body.collegeId) return res.status(400).json({ error: "Select a college for this student account." });
    if (role === "student" && !req.body.departmentId) return res.status(400).json({ error: "Select a department for this student account." });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });

    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      mustChangePassword: role !== "admin",
      collegeId: req.body.collegeId || null,
      departmentId: req.body.departmentId || null,
      department: req.body.department || "",
      studentId: req.body.studentId || "",
      collegeNameLocked: Boolean(req.body.collegeNameLocked),
    });
    res.status(201).json({ user: user.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function bulkCreateUsers(req, res) {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    let created = 0;
    const rejected = [];
    const seen = new Set();
    for (const row of rows) {
      const email = String(row.email ?? "").trim().toLowerCase();
      const name = String(row.name ?? "").trim();
      if (!name || !validateEmail(email) || String(row.password ?? row.temporaryPassword ?? "").length < 10) {
        rejected.push({ email, reason: "Missing name, valid email, or a 10+ character password" });
        continue;
      }
      if (seen.has(email)) {
        rejected.push({ email, reason: "duplicate in file" });
        continue;
      }
      const existing = await User.findOne({ email });
      if (existing) {
        rejected.push({ email, reason: "already exists" });
        continue;
      }
      seen.add(email);
      await User.create({
        name,
        email,
        passwordHash: await bcrypt.hash(String(row.password ?? row.temporaryPassword), 10),
        role: row.role === "teacher" ? "teacher" : row.role === "admin" ? "admin" : "student",
        mustChangePassword: row.role !== "admin",
        collegeId: row.collegeId || null,
        departmentId: row.departmentId || null,
        department: row.department || "",
        studentId: row.studentId || "",
        collegeNameLocked: Boolean(row.collegeNameLocked),
      });
      created += 1;
    }
    res.json({ created, rejected });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteUser(req, res) {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User was not found." });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateProfile(req, res) {
  try {
    const values = req.body;
    if (req.user.role !== "admin") {
      const check = normalizeProfile(values);
      if (check.missing) {
        return res.status(400).json({ error: "Complete all required college and contact details." });
      }
    }
    if (req.user.collegeNameLocked && req.user.collegeName) {
      values.collegeName = req.user.collegeName;
    }
    req.user.profile = {
      ...(req.user.profile?.toObject?.() ?? {}),
      collegeName: String(values.collegeName ?? "").trim(),
      department: String(values.department ?? "").trim(),
      degree: String(values.degree ?? "").trim(),
      studyYear: String(values.studyYear ?? "").trim(),
      state: String(values.state ?? "").trim(),
      city: String(values.city ?? "").trim(),
      pincode: String(values.pincode ?? "").trim(),
      phone: String(values.phone ?? "").trim(),
      about: String(values.about ?? "").trim(),
      photoUrl: String(values.photoUrl ?? "").trim(),
      resumeUrl: String(values.resumeUrl ?? "").trim(),
      resumeName: String(values.resumeName ?? "").trim(),
      complete: true,
    };
    if (req.body.newPassword) {
      req.user.passwordHash = await bcrypt.hash(String(req.body.newPassword), 10);
      req.user.mustChangePassword = false;
    }
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
