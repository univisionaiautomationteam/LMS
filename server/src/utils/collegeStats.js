import { CollegeAdmin } from "../models/CollegeAdmin.js";
import { Teacher } from "../models/Teacher.js";
import { Student } from "../models/Student.js";
import { College } from "../models/College.js";

export async function statsForCollege(collegeId) {
  const college = await College.findById(collegeId).select("name code domains departments").lean();
  if (!college) return null;
  const id = college._id;
  const [teachers, students, collegeAdmins] = await Promise.all([
    Teacher.countDocuments({ collegeId: id }),
    Student.countDocuments({ collegeId: id }),
    CollegeAdmin.countDocuments({ collegeId: id }),
  ]);
  return {
    collegeId: String(id),
    code: college.code,
    name: college.name,
    domains: college.domains ?? [],
    departments: college.departments?.length ?? 0,
    teachers,
    students,
    collegeAdmins,
  };
}
