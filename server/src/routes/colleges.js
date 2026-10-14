import { Router } from "express";
import authRequired from "../middleware/auth.js";
import { listColleges, createCollege, updateCollege, addDepartment, updateDepartmentAccess, deleteCollege } from "../controllers/collegeController.js";

const router = Router();

router.get("/", authRequired(), listColleges);
router.post("/", authRequired(["admin"]), createCollege);
router.put("/:id", authRequired(["admin", "collegeAdmin"]), updateCollege);
router.post("/:id/departments", authRequired(["admin", "collegeAdmin"]), addDepartment);
router.put("/:id/departments/:departmentId/access", authRequired(["admin", "collegeAdmin"]), updateDepartmentAccess);
router.delete("/:id", authRequired(["admin"]), deleteCollege);

export default router;
