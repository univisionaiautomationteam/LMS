import { User } from "../models/User.js";
import { Course } from "../models/Course.js";
import { Asset } from "../models/Asset.js";
import { serverError } from "../utils/helpers.js";
import { scopeToCollege, collegeVisibilityFilter, isSuperAdmin } from "../utils/scope.js";

export async function getStats(req, res) {
  try {
    // The super admin sees the whole platform; a college admin sees only their
    // college's people and content (plus platform-wide courses/assets).
    const userScope = scopeToCollege(req.user);
    const contentScope = isSuperAdmin(req.user) ? {} : collegeVisibilityFilter(req.user);
    const [students, teachers, courses, assets] = await Promise.all([
      User.countDocuments({ ...userScope, role: "student" }),
      User.countDocuments({ ...userScope, role: "teacher" }),
      Course.countDocuments(contentScope),
      Asset.countDocuments(contentScope),
    ]);
    const allUsers = await User.find({ ...userScope, role: { $in: ["student", "teacher"] } });
    const mapped = allUsers.filter(
      (user) => user.role === "student" && user.profile?.complete && user.profile?.state
    ).length;
    res.json({ students, teachers, courses, assets, mapped });
  } catch (error) {
    serverError(res, error, "dashboard.stats");
  }
}
