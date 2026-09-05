import { Router } from "express";
import authRequired from "../middleware/auth.js";
import { listCourses, createCourse, updateCourse, deleteCourse } from "../controllers/courseController.js";

const router = Router();

router.get("/", listCourses);
router.post("/", authRequired(["admin", "teacher"]), createCourse);
router.put("/:id", authRequired(["admin", "teacher"]), updateCourse);
router.delete("/:id", authRequired(["admin", "teacher"]), deleteCourse);

export default router;
