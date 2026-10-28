import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { College } from "../models/College.js";
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

export async function listUsers(req, res) {
  try {
    // Super admin sees everyone; a college admin sees only their own college.
    const users = await User.find(scopeToCollege(req.user)).sort({ role: 1, name: 1 });
    res.json({ users: users.map((user) => user.toPublic()) });
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
    // The creator's own college always wins for non-super accounts, so the
    // request body cannot place an account in someone else's college.
    const collegeId = superAdmin ? req.body.collegeId || null : actor.collegeId;
    if ((role === "student" || role === "teacher") && !collegeId) {
      return res.status(400).json({ error: `Select a college for this ${role} account.` });
    }
    // Teachers and students are created department-wise so a college's people are
    // grouped (ECE teacher belongs to ECE, and ECE students see ECE courses).
    if ((role === "student" || role === "teacher") && !req.body.departmentId) {
      return res.status(400).json({ error: `Select a department for this ${role} account.` });
    }
    if (role === "collegeAdmin" && !collegeId) {
      return res.status(400).json({ error: "Select a college for this college admin account." });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });

    const user = await User.create({
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

    // College domains drive both auto-routing (email -> college) and validation
    // (an imported address must belong to a domain the target college owns).
    const colleges = await College.find().select("code domains").lean();
    const domainOwner = new Map();
    const domainsByCollege = new Map();
    for (const college of colleges) {
      const domains = new Set((college.domains ?? []).map((d) => String(d).toLowerCase()));
      domainsByCollege.set(String(college._id), domains);
      for (const domain of domains) domainOwner.set(domain, String(college._id));
    }

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
      if (!collegeId && domain && domainOwner.has(domain)) collegeId = domainOwner.get(domain);

      if (role === "student" && !collegeId) issues.push("a valid college is required");
      if ((role === "student" || role === "teacher") && !row.departmentId && !row.department) {
        issues.push("a department is required");
      }

      const allowedDomains = collegeId ? domainsByCollege.get(String(collegeId)) : null;
      if (allowedDomains && allowedDomains.size && domain && !allowedDomains.has(domain)) {
        issues.push(`email domain @${domain} is not allowed for this college`);
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
    const existing = new Set(
      (await User.find({ email: { $in: emails } }).select("email").lean()).map((u) => u.email)
    );

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
      await User.bulkWrite(
        accepted.map((item) => ({
          updateOne: {
            filter: { email: item.email },
            update: {
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
            upsert: true,
          },
        })),
        { ordered: false }
      );
    }

    const created = accepted.filter((item) => !existing.has(item.email)).length;
    res.json({ created, updated: accepted.length - created, rejected });
  } catch (error) {
    serverError(res, error, "users.bulkCreate");
  }
}

/**
 * Moves a teacher or student into another department of the same college.
 * Department-wise grouping keeps course alignment simple: an ECE teacher and
 * ECE students share the ECE department, so the admin grants ECE its courses.
 */
export async function assignUserDepartment(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User was not found." });
    if (!isSuperAdmin(req.user) && String(user.collegeId ?? "") !== String(req.user.collegeId ?? "")) {
      return res.status(403).json({ error: "You can only manage accounts in your own college." });
    }
    if (user.role !== "student" && user.role !== "teacher") {
      return res.status(400).json({ error: "Only teachers and students belong to a department." });
    }
    user.departmentId = req.body.departmentId || null;
    user.department = String(req.body.department ?? "");
    // Keep the profile's department mirror in step with the admin assignment so
    // the teacher/student profile page and the required-field check agree.
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
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User was not found." });
    // A college admin can only remove people from their own college.
    if (!isSuperAdmin(req.user) && String(user.collegeId ?? "") !== String(req.user.collegeId ?? "")) {
      return res.status(403).json({ error: "You can only manage accounts in your own college." });
    }
    await User.deleteOne({ _id: user._id });
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error, "users.delete");
  }
}

export async function updateProfile(req, res) {
  try {
    const values = { ...(req.body ?? {}) };

    // Departments are assigned by the college admin, not self-service. For a
    // teacher or student we ignore whatever they posted and mirror the
    // admin-assigned department, so the profile stays in sync and can never be
    // used to move between departments.
    if (req.user.role === "teacher" || req.user.role === "student") {
      values.department = String(req.user.department ?? "").trim();
    }

    if (req.body.newPassword) {
      const currentPassword = String(req.body.currentPassword ?? "");
      if (!currentPassword) {
        return res.status(400).json({ error: "Enter your current password to set a new one." });
      }
      const matches = await req.user.comparePassword(currentPassword);
      if (!matches) {
        // 400, not 401: the caller's session is fine, only the password they
        // typed was wrong. A 401 here makes the client treat it as an expired
        // session and sign the user out mid-save.
        return res.status(400).json({ error: "Your current password is incorrect." });
      }
      if (String(req.body.newPassword).length < PASSWORD_MIN) {
        return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters.` });
      }
    }

    // A locked college is read from profile.collegeName; there is no top-level
    // collegeName field, so the previous check against req.user.collegeName
    // could never be true and the lock never applied.
    const lockedCollege = req.user.collegeNameLocked ? (req.user.profile?.collegeName ?? "") : "";

    const built = buildProfile(
      values,
      req.user.profile?.toObject?.() ?? {},
      req.user.role,
      lockedCollege
    );

    if (built.missing && !isAdminRole(req.user.role)) {
      return res.status(400).json({ error: `Complete your ${profileFieldLabel(built.missing)}.` });
    }

    // Phone number validation
    if (built.profile.phone) {
      const phoneDigits = built.profile.phone.replace(/[^0-9]/g, "");
      if (phoneDigits.length < 7 || phoneDigits.length > 15 || /[a-zA-Z]/.test(built.profile.phone)) {
        return res.status(400).json({ error: "Phone number must contain only numbers." });
      }
    }

    req.user.profile = built.profile;

    if (req.body.newPassword) {
      req.user.passwordHash = await bcrypt.hash(String(req.body.newPassword), 10);
      req.user.mustChangePassword = false;
      // Invalidates every previously issued JWT for this account, including the
      // one making this request, so a replacement token has to be returned or
      // the client is left holding a dead token and gets signed out.
      req.user.tokenVersion = (req.user.tokenVersion ?? 0) + 1;
    }
    await req.user.save();
    res.json({ user: req.user.toPublic(), token: signToken(req.user) });
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
    const { goal, changed } = currentGoal(req.user);
    if (changed) {
      req.user.weeklyGoal = goal;
      await req.user.save();
    }
    res.json({ goal });
  } catch (error) {
    serverError(res, error, "users.weeklyGoal.get");
  }
}

export async function updateWeeklyGoal(req, res) {
  try {
    const { goal } = currentGoal(req.user);
    const target = clampWeekMinutes(req.body?.targetMinutes, goal.targetMinutes);
    const completed = clampWeekMinutes(req.body?.completedMinutes, goal.completedMinutes);
    if (target === 0) {
      return res.status(400).json({ error: "Weekly target must be at least 1 minute." });
    }
    req.user.weeklyGoal = { targetMinutes: target, completedMinutes: completed, weekKey: goal.weekKey };
    await req.user.save();
    res.json({ goal: req.user.weeklyGoal.toObject() });
  } catch (error) {
    serverError(res, error, "users.weeklyGoal.update");
  }
}
