import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { signToken } from "../middleware/auth.js";
import { validateEmail } from "../utils/helpers.js";

const PASSWORD_MIN = 10;

export async function login(req, res) {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    const user = await User.findOne({ email });
    if (!user || !user.active) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: "Email or password is incorrect." });

    const token = signToken(user);

    if (user.mustChangePassword) {
      return res.json({ user: user.toPublic(), token, status: "new_password_required" });
    }

    return res.json({ user: user.toPublic(), token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export function me(req, res) {
  res.json({ user: req.user.toPublic() });
}

export async function completePassword(req, res) {
  try {
    const password = String(req.body.password ?? "");
    if (password.length < PASSWORD_MIN) {
      return res.status(400).json({ error: "Create a password with at least 10 characters." });
    }
    req.user.passwordHash = await bcrypt.hash(password, 10);
    req.user.mustChangePassword = false;
    await req.user.save();
    const token = signToken(req.user);
    return res.json({ user: req.user.toPublic(), token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role: "student", mustChangePassword: false });
    const token = signToken(user);
    return res.status(201).json({ user: user.toPublic(), token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
