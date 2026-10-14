import { Router } from "express";
import authRequired from "../middleware/auth.js";
import { codeRunLimiter } from "../middleware/limits.js";
import { runCode } from "../controllers/codeController.js";

const router = Router();

router.post("/", authRequired(), codeRunLimiter, runCode);

export default router;
