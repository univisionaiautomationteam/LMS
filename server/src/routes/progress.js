import { Router } from "express";
import authRequired from "../middleware/auth.js";
import { getProgress, setLessonProgress, getQuiz, submitQuiz } from "../controllers/progressController.js";

const router = Router();

router.get("/", authRequired(), getProgress);
router.get("/:courseId/quiz", authRequired(), getQuiz);
router.get("/:courseId/quiz/:lessonKey", authRequired(), getQuiz);
router.post("/:courseId/quiz", authRequired(), submitQuiz);
router.post("/:courseId/quiz/:lessonKey", authRequired(), submitQuiz);
router.put("/:courseId/:lessonId", authRequired(), setLessonProgress);

export default router;
