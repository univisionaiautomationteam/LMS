import { Router } from "express";
import authRequired from "../middleware/auth.js";
import {
  listUsers,
  createUser,
  bulkCreateUsers,
  assignUserDepartment,
  deleteUser,
  updateProfile,
  getWeeklyGoal,
  updateWeeklyGoal,
} from "../controllers/userController.js";

const router = Router();

router.get("/", authRequired(["admin", "collegeAdmin"]), listUsers);
router.post("/", authRequired(["admin", "collegeAdmin"]), createUser);
router.post("/bulk", authRequired(["admin", "collegeAdmin"]), bulkCreateUsers);
router.put("/:id/department", authRequired(["admin", "collegeAdmin"]), assignUserDepartment);
router.delete("/:id", authRequired(["admin", "collegeAdmin"]), deleteUser);
router.put("/profile", authRequired(), updateProfile);
router.get("/weekly-goal", authRequired(), getWeeklyGoal);
router.put("/weekly-goal", authRequired(), updateWeeklyGoal);

export default router;
