import { Router } from "express";
import authRequired from "../middleware/auth.js";
import { loginLimiter, registerLimiter } from "../middleware/limits.js";
import { login, me, completePassword, register } from "../controllers/authController.js";

const router = Router();

router.post("/login", loginLimiter, login);
router.get("/me", authRequired(), me);
router.post("/complete-password", authRequired(), completePassword);
router.post("/register", registerLimiter, register);

export default router;
