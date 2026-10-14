import { Router } from "express";
import authRequired from "../middleware/auth.js";
import { getStats } from "../controllers/dashboardController.js";

const router = Router();

router.get("/", authRequired(["admin", "collegeAdmin"]), getStats);

export default router;
