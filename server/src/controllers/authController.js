import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { CollegeAdmin } from "../models/CollegeAdmin.js";
import { Teacher } from "../models/Teacher.js";
import { Student } from "../models/Student.js";
import { findUserByEmail, findUserById } from "../utils/userLookup.js";
import { signToken } from "../middleware/auth.js";
import { validateEmail, serverError, ClientError, PASSWORD_MIN } from "../utils/helpers.js";
import { assertLoginDomainAllowed } from "../utils/domains.js";

const MODEL_BY_ROLE = {
  admin: Admin,
  collegeAdmin: CollegeAdmin,
  teacher: Teacher,
  student: Student,
};

export async function login(req, res) {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    const found = await findUserByEmail(email);
    if (!found) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    const { user, role } = found;
    if (!user.active) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Email or password is incorrect." });

    const domainCheck = await assertLoginDomainAllowed(user, role);
    if (!domainCheck.ok) return res.status(403).json({ error: domainCheck.error });

    const token = signToken(user, role);

    if (user.mustChangePassword) {
      return res.json({ user: user.toPublic ? user.toPublic() : user, token, status: "new_password_required" });
    }

    return res.json({ user: user.toPublic ? user.toPublic() : user, token });
  } catch (error) {
    return serverError(res, error, "auth.login");
  }
}

export function me(req, res) {
  res.json({ user: req.user });
}

export async function completePassword(req, res) {
  try {
    const password = String(req.body.password ?? "");
    if (password.length < PASSWORD_MIN) {
      return res.status(400).json({ error: "Create a password with at least 10 characters." });
    }
    const Model = getUserModelForReq(req.user);
    req.user.passwordHash = await bcrypt.hash(password, 10);
    req.user.mustChangePassword = false;
    req.user.tokenVersion = (req.user.tokenVersion ?? 0) + 1;
    await req.user.save();
    const token = signToken(req.user, req.user.role);
    return res.json({ user: req.user.toPublic ? req.user.toPublic() : req.user, token });
  } catch (error) {
    return serverError(res, error, "auth.completePassword");
  }
}

export async function register(req, res) {
  try {
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    if (!name) return res.status(400).json({ error: "Full name is required." });
    if (!validateEmail(email)) return res.status(400).json({ error: "A valid email is required." });
    if (password.length < PASSWORD_MIN) {
      return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters.` });
    }
    const existing = await findUserByEmail(email);
    if (existing) throw new ClientError(409, "An account with this email already exists.");

    const passwordHash = await bcrypt.hash(password, 10);
    const StudentModel = Student;
    const user = await StudentModel.create({ name, email, passwordHash, role: "student", mustChangePassword: false });
    const token = signToken(user, "student");
    return res.status(201).json({ user: user.toPublic(), token });
  } catch (error) {
    return serverError(res, error, "auth.register");
  }
}

function getUserModelForReq(user) {
  return MODEL_BY_ROLE[user.role] || Student;
}
