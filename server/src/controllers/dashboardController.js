import { CollegeAdmin } from "../models/CollegeAdmin.js";
import { Teacher } from "../models/Teacher.js";
import { Student } from "../models/Student.js";
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

    const [students, teachers, collegeAdmins, courses, assets] = await Promise.all([
      userScope.collegeId
        ? Student.countDocuments({ collegeId: userScope.collegeId })
        : Student.countDocuments({}),
      userScope.collegeId
        ? Teacher.countDocuments({ collegeId: userScope.collegeId })
        : Teacher.countDocuments({}),
      userScope.collegeId
        ? CollegeAdmin.countDocuments({ collegeId: userScope.collegeId })
        : CollegeAdmin.countDocuments({}),
      Course.countDocuments(contentScope),
      Asset.countDocuments(contentScope),
    ]);

    // Count mapped students (those with complete profile and state)
    let mapped = 0;
    if (userScope.collegeId) {
      const studentDocs = await Student.find({ collegeId: userScope.collegeId });
      mapped = studentDocs.filter(
        (u) => u.profile?.complete && u.profile?.state
      ).length;
    } else {
      const studentDocs = await Student.find({});
      mapped = studentDocs.filter(
        (u) => u.profile?.complete && u.profile?.state
      ).length;
    }

    res.json({ students, teachers, collegeAdmins, courses, assets, mapped });
  } catch (error) {
    serverError(res, error, "dashboard.stats");
  }
}
