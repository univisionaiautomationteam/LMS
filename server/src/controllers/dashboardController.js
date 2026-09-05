import { User } from "../models/User.js";
import { Course } from "../models/Course.js";
import { Asset } from "../models/Asset.js";

export async function getStats(_req, res) {
  try {
    const [students, teachers, courses, assets] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "teacher" }),
      Course.countDocuments(),
      Asset.countDocuments(),
    ]);
    const allUsers = await User.find({ role: { $in: ["student", "teacher"] } });
    const mapped = allUsers.filter(
      (user) => user.role === "student" && user.profile?.complete && user.profile?.state
    ).length;
    res.json({ students, teachers, courses, assets, mapped });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
