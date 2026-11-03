import { Router } from "express";
import authRequired from "../middleware/auth.js";
import {
  listCourses,
  listMyCourses,
  getCourse,
  createCourse,
  updateCourse,
  updateCurriculum,
  deleteCourse,
} from "../controllers/courseController.js";

const router = Router();

router.get("/", authRequired(), listCourses);
router.get("/mine", authRequired(["teacher"]), listMyCourses);
router.get("/:id", authRequired(["admin", "collegeAdmin", "teacher"]), getCourse);
router.post("/", authRequired(["admin", "collegeAdmin", "teacher"]), createCourse);
router.put("/:id", authRequired(["admin", "collegeAdmin", "teacher"]), updateCourse);
router.put("/:id/curriculum", authRequired(["admin", "collegeAdmin", "teacher"]), updateCurriculum);
router.delete("/:id", authRequired(["admin", "collegeAdmin", "teacher"]), deleteCourse);

export default router;
