import { Router } from "express";
import authRequired from "../middleware/auth.js";
import { login, me, completePassword, register } from "../controllers/authController.js";

const router = Router();

router.post("/login", login);
router.get("/me", authRequired(), me);
router.post("/complete-password", authRequired(), completePassword);
router.post("/register", register);

export default router;
