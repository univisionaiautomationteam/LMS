import { Router } from "express";
import authRequired from "../middleware/auth.js";
import { teacherStats } from "../controllers/courseController.js";

const router = Router();

router.get("/stats", authRequired(["teacher"]), teacherStats);

export default router;
