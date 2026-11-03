import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { CollegeAdmin } from "../models/CollegeAdmin.js";
import { Teacher } from "../models/Teacher.js";
import { Student } from "../models/Student.js";
import { findUserByEmail, findAllUsers, findUserById } from "../utils/userLookup.js";
import { signToken } from "../middleware/auth.js";
import {
  validateEmail,
  serverError,
  PASSWORD_MIN,
  buildProfile,
  profileFieldLabel,
  weekKeyFor,
  clampWeekMinutes,
  isAdminRole,
} from "../utils/helpers.js";
import { isSuperAdmin, scopeToCollege } from "../utils/scope.js";
import { assertEmailAllowedForCollege, emailDomain, loadDomainRegistry } from "../utils/domains.js";
import { College } from "../models/College.js";

const MODEL_BY_ROLE = {
  admin: Admin,
  collegeAdmin: CollegeAdmin,
  teacher: Teacher,
  student: Student,
};

function getModel(role) {
  return MODEL_BY_ROLE[role];
}

export async function listUsers(req, res) {
  try {
    // Super admin sees everyone; a college admin sees only their own college.
    const users = await findAllUsers(
      !isSuperAdmin(req.user) ? req.user.collegeId : null,
      !isSuperAdmin(req.user) ? (req.user.role === "collegeAdmin" ? undefined : null) : null
    );
    // Filter out collegeAdmins for college admin view (they can only see teachers/students)
    let filtered = users;
    if (!isSuperAdmin(req.user) && req.user.role === "collegeAdmin") {
      filtered = users.filter((u) => u.role !== "collegeAdmin" && u.role !== "admin");
    }
    res.json({ users: filtered.map((user) => user.toPublic ? user.toPublic() : user) });
  } catch (error) {
    serverError(res, error, "users.list");
  }
}

export async function createUser(req, res) {
  try {
    const actor = req.user;
    const superAdmin = isSuperAdmin(actor);
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? req.body.temporaryPassword ?? "");
    const requestedRole = String(req.body.role ?? "student");
    const role = ["admin", "collegeAdmin", "teacher", "student"].includes(requestedRole)
      ? requestedRole
      : "student";
    if (!name) return res.status(400).json({ error: "Full name is required." });
    if (!validateEmail(email)) return res.status(400).json({ error: "A valid email is required." });
    if (password.length < 10) return res.status(400).json({ error: "Temporary password must be at least 10 characters." });

    // A college admin may only provision staff and learners inside their own
    // college; only the super admin creates other admins.
    if (!superAdmin && role !== "teacher" && role !== "student") {
      return res.status(403).json({ error: "You can only create teachers and students." });
    }
    // A college admin must belong to a college.
    if (!superAdmin && !actor.collegeId) {
      return res.status(400).json({ error: "Your account is not assigned to any college. Contact the super admin." });
    }
    // The creator's own college always wins for non-super accounts.
    let collegeId = superAdmin ? req.body.collegeId || null : actor.collegeId;

    // Super admin: infer college from email domain when none selected.
    if (superAdmin && !collegeId && (role === "teacher" || role === "student" || role === "collegeAdmin")) {
      const domain = emailDomain(email);
      if (domain) {
        const { domainOwner } = await loadDomainRegistry();
        const owner = domainOwner.get(domain);
        if (owner) collegeId = owner.collegeId;
      }
    }

    if ((role === "student" || role === "teacher") && !collegeId) {
      return res.status(400).json({ error: `Select a college for this ${role} account.` });
    }
    if ((role === "student" || role === "teacher") && !req.body.departmentId) {
      return res.status(400).json({ error: `Select a department for this ${role} account.` });
    }
    if (role === "collegeAdmin" && !collegeId) {
      return res.status(400).json({ error: "Select a college for this college admin account." });
    }

    if (role !== "admin") {
      const domainCheck = await assertEmailAllowedForCollege(email, collegeId, { role });
      if (!domainCheck.ok) return res.status(400).json({ error: domainCheck.error });
    }

    // Non-super admins cannot assign users to another college.
    if (!superAdmin && collegeId && String(collegeId) !== String(actor.collegeId)) {
      return res.status(403).json({ error: "You can only create accounts in your own college." });
    }

    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });

    const Model = getModel(role);
    const user = await Model.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      mustChangePassword: role !== "admin",
      collegeId,
      departmentId: req.body.departmentId || null,
      department: req.body.department || "",
      studentId: req.body.studentId || "",
      collegeNameLocked: Boolean(req.body.collegeNameLocked),
    });
    res.status(201).json({ user: user.toPublic() });
  } catch (error) {
    serverError(res, error, "users.create");
  }
}

const BULK_ROW_LIMIT = 500;
const BULK_HASH_BATCH = 10;

/**
 * Bulk import = "upsert by email". Re-importing the same roster overwrites the
 * listed fields (and resets the password) instead of erroring, so admins can
 * correct a sheet and re-run it. Duplicate emails inside one file keep the last
 * row. A single `defaultPassword` may stand in for rows that omit one.
 */
export async function bulkCreateUsers(req, res) {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (rows.length > BULK_ROW_LIMIT) {
      return res.status(413).json({ error: `Import at most ${BULK_ROW_LIMIT} rows per file.` });
    }

    const superAdmin = isSuperAdmin(req.user);
    const defaultPassword = String(req.body.defaultPassword ?? "");

    const { domainOwner, domainsByCollege } = await loadDomainRegistry();

    const rejected = [];
    const acceptedByEmail = new Map();

    for (const row of rows) {
      const email = String(row.email ?? "").trim().toLowerCase();
      const name = String(row.name ?? "").trim();
      const password = String(row.password ?? row.temporaryPassword ?? "") || defaultPassword;
      const rawRole = String(row.role ?? "student").toLowerCase();
      const role = ["admin", "collegeAdmin", "teacher", "student"].includes(rawRole) ? rawRole : "student";
      const domain = email.includes("@") ? email.split("@").pop() : "";

      const issues = [];
      if (!name) issues.push("name is required");
      if (!validateEmail(email)) issues.push("a valid email is required");
      if (password.length < PASSWORD_MIN) {
        issues.push(`provide a ${PASSWORD_MIN}+ character password or set a default password`);
      }
      if (!superAdmin && role !== "teacher" && role !== "student") {
        issues.push("college admins can only import teachers and students");
      }

      // College comes from the actor for a college admin, from the row (or the
      // email domain) for the super admin.
      let collegeId = superAdmin ? row.collegeId || "" : req.user.collegeId;
      if (!collegeId && domain && domainOwner.has(domain)) collegeId = domainOwner.get(domain).collegeId;

      if (role === "student" && !collegeId) issues.push("a valid college is required");
      if ((role === "student" || role === "teacher") && !row.departmentId && !row.department) {
        issues.push("a department is required");
      }

      const allowedDomains = collegeId ? domainsByCollege.get(String(collegeId)) : null;
      if (allowedDomains && allowedDomains.size && domain && !allowedDomains.has(domain)) {
        issues.push(`email must use one of this college's domains (${[...allowedDomains].map((d) => `@${d}`).join(", ")})`);
      }
      if (collegeId && allowedDomains && !allowedDomains.size) {
        issues.push("target college has no email domains configured");
      }

      if (issues.length) {
        rejected.push({ email, reason: issues.join("; ") });
        continue;
      }
      acceptedByEmail.set(email, {
        name,
        email,
        password,
        role,
        collegeId: collegeId || null,
        departmentId: row.departmentId || null,
        department: row.department || "",
        studentId: row.studentId || "",
      });
    }

    const accepted = [...acceptedByEmail.values()];
    const emails = accepted.map((item) => item.email);
    const existingEmails = new Set();
    for (const email of emails) {
      const existing = await findUserByEmail(email);
      if (existing) existingEmails.add(email);
    }

    // bcrypt at cost 10 is intentionally slow; batching keeps the event loop
    // responsive and bounds the work to BULK_ROW_LIMIT hashes.
    const hashed = new Map();
    for (let i = 0; i < accepted.length; i += BULK_HASH_BATCH) {
      await Promise.all(
        accepted.slice(i, i + BULK_HASH_BATCH).map(async (item) => {
          hashed.set(item.email, await bcrypt.hash(item.password, 10));
        })
      );
    }

    if (accepted.length) {
      for (const item of accepted) {
        const Model = getModel(item.role);
        await Model.updateOne(
          { email: item.email },
          {
            $set: {
              name: item.name,
              passwordHash: hashed.get(item.email),
              role: item.role,
              mustChangePassword: item.role !== "admin",
              collegeId: item.collegeId,
              departmentId: item.departmentId,
              department: item.department,
              studentId: item.studentId,
            },
            $setOnInsert: { email: item.email, active: true, tokenVersion: 0 },
          },
          { upsert: true }
        );
      }
    }

    const created = accepted.filter((item) => !existingEmails.has(item.email)).length;
    res.json({ created, updated: accepted.length - created, rejected });
  } catch (error) {
    serverError(res, error, "users.bulkCreate");
  }
}

export async function assignUserDepartment(req, res) {
  try {
    const { user, role } = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "User was not found." });
    if (!isSuperAdmin(req.user) && String(user.collegeId ?? "") !== String(req.user.collegeId ?? "")) {
      return res.status(403).json({ error: "You can only manage accounts in your own college." });
    }
    if (user.role !== "student" && user.role !== "teacher") {
      return res.status(400).json({ error: "Only teachers and students belong to a department." });
    }
    const Model = getModel(user.role);
    user.departmentId = req.body.departmentId || null;
    user.department = String(req.body.department ?? "");
    if (user.profile) user.profile.department = user.department;
    await user.save();
    res.json({ user: user.toPublic() });
  } catch (error) {
    serverError(res, error, "users.assignDepartment");
  }
}

export async function deleteUser(req, res) {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }
    const { user, role } = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "User was not found." });
    // A college admin can only remove people from their own college.
    if (!isSuperAdmin(req.user) && String(user.collegeId ?? "") !== String(req.user.collegeId ?? "")) {
      return res.status(403).json({ error: "You can only manage accounts in your own college." });
    }
    const Model = getModel(user.role);
    await Model.deleteOne({ _id: user._id });
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error, "users.delete");
  }
}

export async function updateProfile(req, res) {
  try {
    const { user, role } = await findUserById(req.user._id.toString());
    if (!user) return res.status(404).json({ error: "User not found." });

    const values = { ...(req.body ?? {}) };

    // Departments are assigned by the college admin, not self-service. For a
    // teacher or student we ignore whatever they posted and mirror the
    // admin-assigned department, so the profile stays in sync and can never be
    // used to move between departments.
    if (user.role === "teacher" || user.role === "student") {
      values.department = String(user.department ?? "").trim();
    }

    if (user.role === "collegeAdmin" && user.collegeId) {
      const college = await College.findById(user.collegeId).select("name").lean();
      if (college?.name) {
        values.collegeName = college.name;
      }
      values.department = "";
    }

    if (req.body.newPassword) {
      const currentPassword = String(req.body.currentPassword ?? "");
      if (!currentPassword) {
        return res.status(400).json({ error: "Enter your current password to set a new one." });
      }
      const matches = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!matches) {
        return res.status(400).json({ error: "Your current password is incorrect." });
      }
      if (String(req.body.newPassword).length < PASSWORD_MIN) {
        return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters.` });
      }
    }

    let lockedCollege = "";
    if (user.role === "collegeAdmin") {
      lockedCollege = String(values.collegeName ?? user.profile?.collegeName ?? "").trim();
    } else if (user.collegeNameLocked) {
      lockedCollege = user.profile?.collegeName ?? "";
    }

    const built = buildProfile(
      values,
      user.profile?.toObject?.() ?? {},
      user.role,
      lockedCollege
    );

    if (built.missing && !isAdminRole(user.role)) {
      return res.status(400).json({ error: `Complete your ${profileFieldLabel(built.missing)}.` });
    }

    user.profile = built.profile;

    if (user.role === "collegeAdmin" && lockedCollege) {
      user.collegeNameLocked = true;
    }

    if (req.body.newPassword) {
      user.passwordHash = await bcrypt.hash(String(req.body.newPassword), 10);
      user.mustChangePassword = false;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    }
    await user.save();
    const token = signToken(user, user.role);
    res.json({ user: user.toPublic(), token });
  } catch (error) {
    serverError(res, error, "users.updateProfile");
  }
}

/** Weekly goal stored against the current ISO week; a stale week resets its counter. */
function currentGoal(user) {
  const stored = user.weeklyGoal?.toObject?.() ?? { ...(user.weeklyGoal ?? {}) };
  const weekKey = weekKeyFor();
  const rolled = stored.weekKey !== weekKey;
  return {
    goal: {
      targetMinutes: clampWeekMinutes(stored.targetMinutes, 300),
      completedMinutes: rolled ? 0 : clampWeekMinutes(stored.completedMinutes),
      weekKey,
    },
    changed: rolled,
  };
}

export async function getWeeklyGoal(req, res) {
  try {
    const { user } = await findUserById(req.user._id.toString());
    if (!user) return res.status(404).json({ error: "User not found." });
    const { goal, changed } = currentGoal(user);
    if (changed) {
      user.weeklyGoal = goal;
      await user.save();
    }
    res.json({ goal });
  } catch (error) {
    serverError(res, error, "users.weeklyGoal.get");
  }
}

export async function updateWeeklyGoal(req, res) {
  try {
    const { user } = await findUserById(req.user._id.toString());
    if (!user) return res.status(404).json({ error: "User not found." });
    const { goal } = currentGoal(user);
    const target = clampWeekMinutes(req.body?.targetMinutes, goal.targetMinutes);
    const completed = clampWeekMinutes(req.body?.completedMinutes, goal.completedMinutes);
    if (target === 0) {
      return res.status(400).json({ error: "Weekly target must be at least 1 minute." });
    }
    user.weeklyGoal = { targetMinutes: target, completedMinutes: completed, weekKey: goal.weekKey };
    await user.save();
    res.json({ goal: user.weeklyGoal.toObject() });
  } catch (error) {
    serverError(res, error, "users.weeklyGoal.update");
  }
}
