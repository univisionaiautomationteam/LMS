import { Router } from "express";
import authRequired from "../middleware/auth.js";
import { listAssets, createAsset, updateAsset, deleteAsset } from "../controllers/assetController.js";

const router = Router();

router.get("/", listAssets);
router.post("/", authRequired(["admin", "teacher"]), createAsset);
router.put("/:id", authRequired(["admin", "teacher"]), updateAsset);
router.delete("/:id", authRequired(["admin", "teacher"]), deleteAsset);

export default router;
