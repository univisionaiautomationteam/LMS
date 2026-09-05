import { Router } from "express";
import authRequired from "../middleware/auth.js";
import { listUsers, createUser, bulkCreateUsers, deleteUser, updateProfile } from "../controllers/userController.js";

const router = Router();

router.get("/", authRequired(["admin"]), listUsers);
router.post("/", authRequired(["admin"]), createUser);
router.post("/bulk", authRequired(["admin"]), bulkCreateUsers);
router.delete("/:id", authRequired(["admin"]), deleteUser);
router.put("/profile", authRequired(), updateProfile);

export default router;
