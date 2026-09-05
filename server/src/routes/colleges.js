import { Router } from "express";
import authRequired from "../middleware/auth.js";
import { listColleges, createCollege, addDepartment, updateDepartmentAccess, deleteCollege } from "../controllers/collegeController.js";

const router = Router();

router.get("/", listColleges);
router.post("/", authRequired(["admin"]), createCollege);
router.post("/:id/departments", authRequired(["admin"]), addDepartment);
router.put("/:id/departments/:departmentId/access", authRequired(["admin"]), updateDepartmentAccess);
router.delete("/:id", authRequired(["admin"]), deleteCollege);

export default router;
